// Voyager — the Verify Gate. ONE gate, but the trust threshold SCALES WITH TIER
// (architecture §4): Tier A passes near-direct; Tier C must be cross-confirmed
// or twin-proved before it enters at full confidence. This module also owns
// confidence calibration (Pillar 5 — epistemic honesty) and the OSV gate
// (security-first — no vulnerable package is ever recommended).

import type { PackageFacts } from './sources/registry.js'
import type { OsvResult } from './sources/osv.js'
import type { TwinResult } from './twin.js'
import type { VoyagerClaim, VoyagerProvenance, VoyagerTier } from './types.js'

/** Base confidence a single source of a given tier earns before evidence. */
const TIER_BASE: Record<VoyagerTier, number> = {
  A: 0.85, // structured API — high, near-direct
  B: 0.8,  // canonical doc — authoritative
  C: 0.4,  // LLM-search — low, must be cross-referenced
  D: 0.95, // live-probe — ground truth (the proof itself)
}

/** Floor confidence by the highest-trust tier among a claim's sources. */
export function calibrateConfidence(provenance: VoyagerProvenance[]): number {
  if (provenance.length === 0) return 0.2
  const best = Math.max(...provenance.map((p) => TIER_BASE[p.tier]))
  // Corroboration counts DISTINCT TIERS, not distinct sources: npm + OSV are two
  // facets of one Tier-A claim, not an independent second opinion. A genuine
  // cross-tier confirmation (e.g. Tier-A fact + a Tier-C web mention cross-
  // referenced, or a Tier-D twin proof) is what earns the nudge.
  const distinctTiers = new Set(provenance.map((p) => p.tier)).size
  const corroboration = Math.min(0.08, 0.04 * (distinctTiers - 1))
  return Math.min(0.98, best + corroboration)
}

export interface PackageVerdict {
  /** The verified claim, ready for the brief. */
  claim: VoyagerClaim
  /** True if Voyager would recommend this package (OSV-clean, not deprecated). */
  recommended: boolean
}

// ── Install-script danger scan ────────────────────────────────────────────────
// The twin proof installs with --ignore-scripts, so an obfuscated lifecycle
// script (leftpad-reborn's postinstall: base64 → child_process → HTTP egress)
// is NEVER executed or vetted — yet it detonates on a real `npm install`. We
// cannot fetch the tarball here, but the packument exposes the INLINE command
// strings for free, and an obfuscated payload is usually inline. This static
// scan catches the classic signals in those commands. Bounded, ReDoS-safe
// (no nested quantifiers) — it runs over short, capped strings.
const SCRIPT_DANGER: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\beval\s*\(/i, label: 'eval(' },
  { re: /\bnew\s+Function\s*\(/i, label: 'new Function(' },
  { re: /\batob\s*\(/i, label: 'atob( (base64 decode)' },
  { re: /Buffer\.from\s*\([^)]{0,80}base64/i, label: "Buffer.from(...,'base64')" },
  { re: /\bbase64\s*(?:-{1,2}d(?:ecode)?|-D)\b/i, label: 'base64 --decode (shell)' },
  { re: /child_process|\bexecSync\b|\bspawnSync\b|\bexecFileSync\b/i, label: 'child_process' },
  { re: /require\s*\(\s*['"](?:node:)?(?:http|https|net|dns|tls|dgram)['"]\s*\)/i, label: "require('http'|'net'|…)" },
  { re: /\b(?:curl|wget|ncat|certutil|bitsadmin|Invoke-WebRequest|iwr)\b/i, label: 'shell egress tool (curl/wget/…)' },
  { re: /\|\s*(?:sh|bash|zsh|node|python[23]?|perl|ruby)\b/i, label: 'pipe-to-interpreter' },
  { re: /\bfs\.(?:write|append|create)\w*\s*\(\s*['"`]?(?:\/|~|\.\.)/i, label: 'fs write outside cwd' },
]

/** Scan the INLINE lifecycle-script commands for classic malware signals. Returns
 *  the distinct danger labels found (empty = nothing suspicious in the commands —
 *  which is NOT a safety proof: the referenced script FILES are not fetched). */
export function scanInstallScripts(scripts: Record<string, string>): string[] {
  const hits = new Set<string>()
  for (const cmd of Object.values(scripts ?? {})) {
    if (typeof cmd !== 'string') continue
    for (const { re, label } of SCRIPT_DANGER) if (re.test(cmd)) hits.add(label)
  }
  return [...hits]
}

/**
 * Build the verified claim for a package from its three evidence streams. This
 * is where the OSV gate and the twin proof decide fact-vs-belief and whether the
 * package may be recommended at all.
 */
export function gatePackage(args: {
  facts: PackageFacts
  osv: OsvResult | null
  /** Error string if the OSV check itself failed (fail-closed). */
  osvError?: string
  twin: TwinResult | null
}): PackageVerdict {
  const { facts, osv, osvError, twin } = args
  const provenance: VoyagerProvenance[] = [facts.provenance]
  if (osv) provenance.push(osv.provenance)

  const warnings: string[] = []
  let recommended = true

  // ── OSV gate (security-first), FAIL-CLOSED on anything but a real clean result.
  // Explicit tri-state so "we never asked OSV" (osv===null, no error) can NEVER
  // read as clean — gatePackage is a PUBLIC api and must be safe when a caller
  // passes osv:null. 'clean' is the ONLY state that permits a recommendation or
  // the "no known vulnerabilities" wording. ('clean' still means only "no PUBLICLY
  // KNOWN vulns within OSV's coverage" — not "safe": malware/typosquat/hijack are
  // out of OSV's scope, and the statement says so.)
  const securityStatus: 'clean' | 'vulnerable' | 'unknown' = osvError ? 'unknown' : osv == null ? 'unknown' : !osv.clean ? 'vulnerable' : 'clean'
  if (securityStatus === 'vulnerable') {
    recommended = false
    const ids = osv!.vulns.map((v) => v.id).slice(0, 5).join(', ')
    warnings.push(`KNOWN VULNERABILITIES (OSV): ${ids}${osv!.vulns.length > 5 ? ` +${osv!.vulns.length - 5}` : ''} — NOT recommended`)
  } else if (securityStatus === 'unknown') {
    recommended = false
    warnings.push(osvError ? `OSV not verifiable (${osvError}) — not recommended until security is confirmed` : 'OSV was not consulted — security posture UNKNOWN, not recommended (no known-vulnerability check ran)')
  }

  // ── Registry negative signals ──────────────────────────────────────────────
  if (facts.deprecated) {
    recommended = false
    warnings.push(`deprecated package: ${String(facts.deprecated).slice(0, 120)}`)
  }
  if (!facts.latestVersion) {
    recommended = false
    warnings.push('package not found in the registry')
  }

  // ── Supply-chain cautions (non-blocking signals) ───────────────────────────
  // Missing license is a real legal/supply-chain risk; a brand-new package is a
  // classic typosquat/hijack vector. Surfaced as warnings, not hard blocks.
  if (facts.latestVersion && !facts.license) {
    warnings.push('no license declared — legal/redistribution risk')
  }
  const ageDays = facts.firstPublished ? (Date.parse(facts.firstPublished) ? (Date.now() - Date.parse(facts.firstPublished)) / 86_400_000 : NaN) : NaN
  if (Number.isFinite(ageDays) && ageDays < 30) {
    warnings.push(`very new package (first published ~${Math.round(ageDays)}d ago) — supply-chain caution`)
  }

  // ── Fact vs belief: ONLY an ISOLATED twin proof promotes to FACT (Tier D) ────
  // A smoke that ran on the host (VOYAGER_TWIN_HOST=1 escape hatch) is weaker
  // evidence gathered in an unsafe way — it must never earn Tier-D confidence.
  // The version we actually VERIFIED: the registry-resolved concrete version that
  // OSV was pinned to. Everything in the verdict binds to THIS — never to a twin
  // that may have resolved a different dist-tag at install time.
  const verifiedVersion = facts.latestVersion ?? null
  const twinVersionMismatch = Boolean(twin?.proved && twin.installedVersion && verifiedVersion && twin.installedVersion !== verifiedVersion)
  if (twinVersionMismatch) {
    // The twin installed a DIFFERENT version than the one OSV cleared → the streams
    // are not about the same artifact. Do not let the twin promote or reassure.
    recommended = false
    warnings.push(`version mismatch: OSV verified ${verifiedVersion} but the twin installed ${twin!.installedVersion} — verdict not bound to one artifact; pin an exact version`)
  }

  // ── Install/lifecycle scripts — npm's #1 malware vector (leftpad-reborn) ─────
  // The twin proof installs with --ignore-scripts, so a preinstall/install/
  // postinstall/prepare hook was NOT executed or vetted. A package that ships one
  // can therefore NEVER be certified a twin-proved FACT — the proof covers a
  // DEFANGED artifact while the real `npm install` would run the hook. Cap it at
  // belief, drop confidence hard, and disclose loudly. A static scan of the inline
  // commands escalates an obfuscated egress payload to not-recommended.
  const installScripts = facts.installScripts ?? {}
  const hasInstallScripts = Boolean(facts.hasInstallScripts)
  const scriptDangers = hasInstallScripts ? scanInstallScripts(installScripts) : []
  if (hasInstallScripts) {
    const hooks = Object.keys(installScripts).join('/') || 'lifecycle'
    warnings.push(
      `has install/lifecycle scripts (${hooks}) — install scripts NOT executed in the twin proof ` +
        `(the twin installs with --ignore-scripts), so install-time behavior is UNVERIFIED and unvetted ` +
        `(npm's #1 malware vector). Treat as UNVERIFIED for install-time behavior.`,
    )
    if (scriptDangers.length) {
      recommended = false
      warnings.push(
        `DANGER SIGNALS in the install-script commands: ${scriptDangers.join(', ')} — ` +
          `looks like an obfuscated/egress payload; NOT recommended`,
      )
    }
  }

  let epistemic: VoyagerClaim['epistemic'] = 'belief'
  // FACT requires an isolated twin proof AND no install scripts: with lifecycle
  // scripts present the proof certifies only the --ignore-scripts (defanged)
  // artifact, never the install-time behavior — so it stays a belief.
  if (twin?.proved && twin.isolated && !twinVersionMismatch && !hasInstallScripts) {
    epistemic = 'fact'
    provenance.push({
      source: 'twin probe (isolated container)',
      tier: 'D',
      fetchedAt: new Date().toISOString(),
    })
  } else if (twin?.proved && twin.isolated && hasInstallScripts) {
    // Import reproduced, but scripts were skipped — a belief, not a fact. The
    // prominent install-script warning above already carries the disclosure.
  } else if (twin?.proved && !twin.isolated) {
    warnings.push('twin smoke passed on the HOST (not isolated) — stays a belief; use a container runtime for Tier-D proof')
  } else if (twin && twin.status !== 'skipped' && !twin.proved) {
    // The twin is a POSITIVE prover. Not reproducing does NOT make a package
    // unsafe — OSV governs safety. It just stays a BELIEF, with a note. (This
    // also avoids falsely rejecting an ESM-only or unusual-entrypoint package.)
    warnings.push(`twin did not reproduce (${twin.status}: ${twin.reason ?? ''}) — stays a belief`.trim())
  }

  let confidence = calibrateConfidence(provenance)
  // Install scripts are an UNVERIFIED (unvetted) surface — never high-confidence.
  if (hasInstallScripts) confidence = Math.min(confidence, 0.5)
  // A blocked recommendation must not read as high-confidence-good.
  if (!recommended) confidence = Math.min(confidence, 0.45)

  // Bind the stated version to the VERIFIED one (never a mismatched twin's).
  const verStr = verifiedVersion ?? '?'
  // Honest wording: "clean" is "no known vulns within OSV coverage", never "safe".
  const goodPhrase = epistemic === 'fact' ? `no known vulnerabilities (OSV) + import reproduced in an isolated twin` : `no known vulnerabilities (OSV, within coverage)`
  // A recommended package that still ships lifecycle scripts must disclose that the
  // twin proof did NOT execute them, so 'belief' never over-claims install safety.
  const scriptDisclosure = hasInstallScripts
    ? (twin?.proved ? ' (install scripts NOT executed in the twin proof)' : ' (install scripts present — NOT executed/vetted)')
    : ''
  const statement = recommended
    ? `${facts.name}@${verStr} (${facts.ecosystem}) — ${goodPhrase}${scriptDisclosure}, ${facts.license ?? 'license n/a'}`
    : `${facts.name}${verifiedVersion ? `@${verStr}` : ''} (${facts.ecosystem}) — NOT recommended: ${warnings.join('; ')}`

  return {
    recommended,
    claim: {
      statement,
      epistemic,
      confidence,
      provenance,
      data: {
        name: facts.name,
        ecosystem: facts.ecosystem,
        latestVersion: facts.latestVersion,
        installedVersion: twin?.installedVersion ?? null,
        license: facts.license,
        deprecated: facts.deprecated,
        lastPublished: facts.lastPublished,
        firstPublished: facts.firstPublished,
        vulns: osv?.vulns ?? [],
        securityStatus,
        twinStatus: twin?.status ?? 'not-run',
        twinVersionMismatch,
        hasInstallScripts,
        installScripts,
        scriptDangers,
        recommended,
      },
      ...(warnings.length ? { warning: warnings.join('; ') } : {}),
    },
  }
}
