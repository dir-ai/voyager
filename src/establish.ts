// Voyager — adversarial establishment (Pillar 2). A claim doesn't enter the
// Genome because one source asserted it. It runs a gauntlet:
//
//   PROPOSER  asserts a candidate fact (a source: "react@19 exists, MIT").
//   SKEPTIC   tries to REFUTE it (counter-source / breaking case / CVE):
//             OSV vulns, registry deprecation, not-found, fail-closed on an
//             unverifiable security check.
//   JUDGE     runs the PROOF in the twin (install+smoke). Survives → it's a
//             FACT; proof skipped → it stays a BELIEF; proof fails or the
//             skeptic landed a killer → REJECTED.
//
// Truth by reproduction, not by authority. The verdict carries the full trace so
// the brief (and later the Genome) records WHY a fact was trusted.
//
// The decision core (`buildEstablishment`) is PURE over already-fetched evidence
// → unit-testable without the network. `establishPackage` is the thin async
// shell that gathers the evidence (reusing the existing sources) and calls it.

import { packageFacts, type PackageFacts } from './sources/registry.js'
import { osvCheck, type OsvResult } from './sources/osv.js'
import { provePackageInTwin, type TwinResult } from './twin.js'
import { gatePackage } from './gate.js'
import { analyzePeerCompat, hasHardConflict } from './compat.js'
import type { PackageQuery, VoyagerClaim } from './types.js'

export type EstablishVerdict = 'fact' | 'belief' | 'rejected'
export type EstablishRole = 'proposer' | 'skeptic' | 'judge'

export interface EstablishStep {
  role: EstablishRole
  finding: string
  /** Did this stage support the claim (true) or undermine it (false)? */
  pass: boolean
}

export interface Establishment {
  verdict: EstablishVerdict
  /** The composed claim (null only when the proposer found nothing to assert). */
  claim: VoyagerClaim | null
  steps: EstablishStep[]
  /**
   * Set ONLY when the verdict could not be computed because of a tool/registry
   * FAILURE (network, timeout, oversized response) — NOT because the package is
   * bad. Callers map this to a distinct exit code (2) so CI can tell "voyager is
   * broken" apart from "this package is unsafe" (rejected → 1).
   */
  error?: string
}

/**
 * PURE decision core: given the gathered evidence, run the adversarial verdict
 * and emit the trace. No I/O — same inputs as gatePackage plus the twin result.
 */
/** True when a version string is a RANGE/complex spec (not an exact version). An
 *  exact `1.2.3(-pre)(+build)` is false; `^1`, `~1.2`, `>=1 <2`, `1.x`, `1||2`,
 *  and whitespace-joined ranges are true. Dist-tags (latest/next/beta) resolve at
 *  the registry so they never reach this path. */
function isVersionRange(v: string): boolean {
  const s = v.trim()
  if (/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(s)) return false // exact semver
  if (/[\^~><=*|]|\s|\s-\s/.test(s)) return true
  return s.split('.').some((p) => p === 'x' || p === 'X' || p === '*')
}

export function buildEstablishment(args: {
  facts: PackageFacts
  osv: OsvResult | null
  osvError?: string
  twin: TwinResult | null
  /** The project's declared deps (name → version/range) for the compat check. */
  projectDeps?: Record<string, string>
}): Establishment {
  const { facts, osv, osvError, twin, projectDeps } = args
  const steps: EstablishStep[] = []

  // ── Proposer ────────────────────────────────────────────────────────────────
  if (!facts.latestVersion) {
    steps.push({ role: 'proposer', finding: `${facts.name} does not exist in the ${facts.ecosystem} registry`, pass: false })
    return { verdict: 'rejected', claim: null, steps }
  }
  steps.push({
    role: 'proposer',
    finding: `${facts.name}@${facts.latestVersion} exists (${facts.license ?? 'license n/a'})`,
    pass: true,
  })

  // ── Skeptic (tries to refute) ───────────────────────────────────────────────
  if (osvError) {
    steps.push({ role: 'skeptic', finding: `OSV not verifiable (${osvError}) — fail-closed`, pass: false })
  } else if (osv && !osv.clean) {
    steps.push({
      role: 'skeptic',
      finding: `known CVEs: ${osv.vulns.map((v) => v.id).slice(0, 3).join(', ')}${osv.vulns.length > 3 ? ` +${osv.vulns.length - 3}` : ''}`,
      pass: false,
    })
  } else if (osv) {
    steps.push({ role: 'skeptic', finding: 'OSV clean, no known CVEs', pass: true })
  } else {
    // osv === null with no error means "not checked" — NOT the same as clean.
    steps.push({ role: 'skeptic', finding: 'OSV not checked', pass: false })
  }
  if (facts.deprecated) {
    steps.push({ role: 'skeptic', finding: `deprecated package: ${facts.deprecated.slice(0, 80)}`, pass: false })
  }
  // Supply-chain provenance: the registry ADVERTISES a build attestation (npm
  // SLSA). Honest wording: we detect its presence, we do not yet verify the
  // signature/transparency-log ourselves — so it is "advertised", not "verified".
  // Absence is not a block (most packages lack it); presence is a real positive.
  if (facts.hasProvenance) {
    steps.push({ role: 'skeptic', finding: 'build provenance attestation advertised by the registry (SLSA; signature not independently verified)', pass: true })
  }
  // Peer-dependency compatibility against the project's declared stack (the safe
  // "does it fit YOUR environment?" check — no install).
  const conflicts = projectDeps ? analyzePeerCompat(projectDeps, facts.peerDependencies) : []
  for (const c of conflicts) {
    steps.push({
      role: 'skeptic',
      finding: c.severity === 'conflict' ? `peer-conflict: ${c.note}` : `peer to verify: ${c.pkg}@${c.required} vs ${c.projectHas}`,
      pass: c.severity !== 'conflict',
    })
  }

  // ── Judge (runs the proof in the twin) ──────────────────────────────────────
  if (twin) {
    if (twin.proved) {
      steps.push({ role: 'judge', finding: `reproduced in twin (installed v${twin.installedVersion ?? '?'})`, pass: true })
    } else if (twin.status === 'skipped') {
      steps.push({ role: 'judge', finding: 'proof-in-twin OFF — stays a belief, not a fact', pass: false })
    } else {
      steps.push({ role: 'judge', finding: `twin did not reproduce (${twin.status}: ${twin.reason ?? ''})`.trim(), pass: false })
    }
  }

  // Reuse the gate for the canonical claim (OSV gate, fact/belief, confidence).
  const { claim, recommended } = gatePackage({ facts, osv, osvError, twin })
  claim.data = { ...(claim.data ?? {}), establishment: steps, peerConflicts: conflicts }

  // A hard peer-conflict is a strong caution (won't fit the stack): surface it
  // prominently and cap confidence. Not an auto-reject — peer ranges are often
  // loose/stale, and the gate's security verdict (OSV/deprecation) stays the boss.
  if (hasHardConflict(conflicts)) {
    const msg = conflicts.filter((c) => c.severity === 'conflict').map((c) => c.note).join('; ')
    claim.warning = claim.warning ? `${claim.warning}; ${msg}` : `⚠ peer-conflict: ${msg}`
    claim.confidence = Math.min(claim.confidence, 0.55)
  }

  // Distinguish "could not verify" from "package is unsafe". If the ONLY reason
  // we won't recommend is that OSV was unreachable — the package exists, is not
  // deprecated, and no vulnerability was actually found — that is UNKNOWN, not a
  // rejection. Surface it on the error channel so the CLI exits 2: fail-closed
  // policy still declines to recommend, but a security-source outage must never
  // be reported as "this package is rejected" (→ a false exit-1 vuln signal).
  if (!recommended && osvError && facts.latestVersion && !facts.deprecated && (!osv || osv.clean)) {
    return { verdict: 'rejected', claim, steps, error: `OSV unavailable — could not verify: ${osvError}` }
  }

  const verdict: EstablishVerdict = !recommended ? 'rejected' : claim.epistemic === 'fact' ? 'fact' : 'belief'
  return { verdict, claim, steps }
}

/**
 * Establish a package adversarially: gather evidence (proposer=registry,
 * skeptic=OSV+registry flags, judge=twin) then run the pure verdict. Never
 * throws — a registry failure is a proposer-failed rejection.
 */
export async function establishPackage(
  pkg: PackageQuery,
  opts: { proveInTwin?: boolean; projectDeps?: Record<string, string> } = {},
): Promise<Establishment> {
  // An empty version string (`express@` → version: '') is malformed input, not a
  // real pin — normalize to "unspecified" so facts + OSV resolve latest instead
  // of building a bogus /pkg/ URL that 404s and looks like "does not exist".
  if (pkg.version === '') pkg = { ...pkg, version: undefined }

  let facts: PackageFacts
  try {
    facts = await packageFacts(pkg)
  } catch (e) {
    const msg = (e as Error)?.message ?? 'error'
    // A 404 is a real statement about the package: it does not exist → a genuine
    // rejection (exit 1). Anything else (oversized response, timeout, 5xx, DNS,
    // an invalid-name guard) is a TOOL failure, not a package verdict → surface
    // it on the `error` channel so the CLI exits 2, never a false "rejected".
    const notFound = /responded 404\b/.test(msg)
    if (notFound) {
      // A 404 for a version RANGE isn't "package doesn't exist": npm's per-version
      // endpoint resolves only exact versions + dist-tags, not ranges. Don't
      // false-REJECT a real package — surface it on the error channel (exit 2).
      if (pkg.version && isVersionRange(pkg.version)) {
        return {
          verdict: 'rejected',
          claim: null,
          error: `"${pkg.name}@${pkg.version}" is a version RANGE, not an exact version — pin an exact version (e.g. resolve it from your lockfile) or omit the version to check latest`,
          steps: [{ role: 'proposer', finding: `cannot resolve a range spec against the registry's per-version endpoint`, pass: false }],
        }
      }
      return {
        verdict: 'rejected',
        claim: null,
        steps: [{ role: 'proposer', finding: `${pkg.name} not found in the ${pkg.ecosystem} registry`, pass: false }],
      }
    }
    return {
      verdict: 'rejected',
      claim: null,
      error: `registry error: ${msg}`,
      steps: [{ role: 'proposer', finding: `registry error (not a verdict on the package): ${msg}`, pass: false }],
    }
  }

  let osv: OsvResult | null = null
  let osvError: string | undefined
  try {
    // Pin OSV to the version that would actually be installed, NOT the whole
    // package — otherwise any package that EVER had a CVE (express, lodash, …)
    // is falsely marked vulnerable. CRITICAL ordering: facts.latestVersion is the
    // registry-RESOLVED concrete version of the requested ref, so it comes first.
    // The raw pkg.version may be a dist-TAG (`latest`, `next`, `beta`) — sending
    // that string to OSV verbatim would return zero matches for a non-version
    // identifier: a silent false negative on a security check.
    osv = await osvCheck({ ...pkg, version: facts.latestVersion ?? pkg.version ?? undefined })
  } catch (e) {
    osvError = (e as Error)?.message ?? 'OSV error'
  }

  const twin = opts.proveInTwin ? await provePackageInTwin(pkg) : null
  return buildEstablishment({ facts, osv, osvError, twin, projectDeps: opts.projectDeps })
}
