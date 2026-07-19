// Voyager — peer-dependency compatibility analysis (F2.2a, the SAFE half of the
// "does it fit YOUR environment?" twin idea). Given the target package's
// peerDependencies and the project's declared stack, flag conflicts BEFORE
// recommending — without installing anything (no tenant-manifest install, no
// download, no new dependency).
//
// Uses the real `semver` library (`intersects`) so caret/tilde/ranges/prerelease
// are correct — a hand-rolled major-only check wrongly called `~1.2.3` and `1.9.0`
// compatible (they are not). Honest by construction:
//   - 'conflict' when the two ranges provably CANNOT be satisfied together.
//   - 'verify' when either side isn't a parseable range (workspace:, git urls,
//     `latest`, `*`) → we never emit a FALSE "incompatible"; we surface uncertainty.

import semver from 'semver'

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

/** A normalized, semver-parseable range, or null if it's a form semver can't
 *  reason about (workspace:/file:/git/`latest`/tag) → caller says "verify". */
function normalizeRange(input: string): string | null {
  const r = (input ?? '').trim()
  if (!r) return null
  if (/^(workspace:|file:|link:|git|https?:|github:|npm:|\*$|latest$|next$)/i.test(r)) return null
  return semver.validRange(r, { loose: true }) ?? null
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
    const reqRange = normalizeRange(required)
    const haveRange = normalizeRange(projectHas)
    if (reqRange === null || haveRange === null) {
      out.push({ pkg, required, projectHas, severity: 'verify', note: 'range not determinable (complex/non-semver spec) — verify manually' })
      continue
    }
    let intersects: boolean
    try {
      intersects = semver.intersects(reqRange, haveRange, { loose: true })
    } catch {
      out.push({ pkg, required, projectHas, severity: 'verify', note: 'ranges could not be compared — verify manually' })
      continue
    }
    if (!intersects) {
      out.push({
        pkg,
        required,
        projectHas,
        severity: 'conflict',
        note: `requires ${pkg}@${required} but the project has ${projectHas} — no overlapping version satisfies both`,
      })
    }
  }
  return out
}

/** True if any hard conflict (not just a 'verify') was found. */
export function hasHardConflict(conflicts: PeerConflict[]): boolean {
  return conflicts.some((c) => c.severity === 'conflict')
}
