// Provenator — peer-dependency compatibility analysis (F2.2a, the SAFE half of the
// "does it fit YOUR environment?" twin idea). Given the target package's
// peerDependencies and the project's declared stack, flag conflicts BEFORE
// recommending — without installing anything (no tenant-manifest install, no
// download, no new dependency).
//
// Deliberately dependency-FREE: no `semver` import (it's only a transitive dep
// here — importing it directly would make the deploy gate fragile). Instead a
// conservative MAJOR-version check, honest by construction:
//   - 'conflict' ONLY when the project's major is provably outside EVERY major
//     the peer range allows (e.g. needs react@^18, project has react@19).
//   - 'verify' when either side is unparseable / a complex range → we never emit
//     a false "incompatible"; we surface uncertainty (epistemic honesty).
//   - compatible majors → no finding.

export interface PeerConflict {
  /** The peer dependency name. */
  pkg: string
  /** The range the target package requires. */
  required: string
  /** The version/range the project declares. */
  projectHas: string
  severity: 'conflict' | 'verify'
  note: string
}

/**
 * A caret-compatibility key for a simple version/range, or null when it is NOT a
 * simple single form. We treat ONLY exact / caret / tilde single versions
 * (`1.2.3`, `^1.2.3`, `~1.2.3`) as certain. Anything with a range operator
 * (`>=`, `<`, `-`, `||`, `*`, `x`, `latest`, `workspace:`) → null → we say
 * "verify" rather than risk a FALSE conflict. Honest by construction.
 *
 * The key follows semver's "compatible-with" axis: for major >= 1 it's the major
 * (`^1.2` ~ `^1.9`); for major 0 the BREAKING axis is the minor, so `^0.1` and
 * `^0.2` are NOT compatible and get distinct keys (`0.1` vs `0.2`).
 */
function compatKey(range: string): string | null {
  const m = range.trim().match(/^[\^~]?(\d+)(?:\.(\d+))?(?:\.\d+)?$/)
  if (!m) return null
  const major = Number(m[1])
  if (major > 0) return String(major)
  const minor = m[2] !== undefined ? m[2] : '0'
  return `0.${minor}`
}

/**
 * Analyze the target's peerDependencies against the project's declared deps.
 * Only peers the project actually has are checked (a peer the project lacks is a
 * separate "missing peer" concern, out of scope here). Pure.
 */
export function analyzePeerCompat(
  projectDeps: Record<string, string>,
  peerDeps: Record<string, string>,
): PeerConflict[] {
  const out: PeerConflict[] = []
  for (const [pkg, required] of Object.entries(peerDeps ?? {})) {
    const projectHas = projectDeps?.[pkg]
    if (!projectHas) continue // project doesn't use this peer → nothing to clash
    const reqKey = compatKey(required)
    const haveKey = compatKey(projectHas)
    if (reqKey === null || haveKey === null) {
      out.push({ pkg, required, projectHas, severity: 'verify', note: 'range not determinable — verify manually' })
      continue
    }
    if (reqKey !== haveKey) {
      out.push({
        pkg,
        required,
        projectHas,
        severity: 'conflict',
        note: `requires ${pkg}@${required} but the project has ${projectHas} (incompatible)`,
      })
    }
  }
  return out
}

/** True if any hard conflict (not just a 'verify') was found. */
export function hasHardConflict(conflicts: PeerConflict[]): boolean {
  return conflicts.some((c) => c.severity === 'conflict')
}
