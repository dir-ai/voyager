// Provenator — the Verify Gate. ONE gate, but the trust threshold SCALES WITH TIER
// (architecture §4): Tier A passes near-direct; Tier C must be cross-confirmed
// or twin-proved before it enters at full confidence. This module also owns
// confidence calibration (Pillar 5 — epistemic honesty) and the OSV gate
// (security-first — no vulnerable package is ever recommended).

import type { PackageFacts } from './sources/registry.js'
import type { OsvResult } from './sources/osv.js'
import type { TwinResult } from './twin.js'
import type { ProvenatorClaim, ProvenatorProvenance, ProvenatorTier } from './types.js'

/** Base confidence a single source of a given tier earns before evidence. */
const TIER_BASE: Record<ProvenatorTier, number> = {
  A: 0.85, // structured API — high, near-direct
  B: 0.8,  // canonical doc — authoritative
  C: 0.4,  // LLM-search — low, must be cross-referenced
  D: 0.95, // live-probe — ground truth (the proof itself)
}

/** Floor confidence by the highest-trust tier among a claim's sources. */
export function calibrateConfidence(provenance: ProvenatorProvenance[]): number {
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
  claim: ProvenatorClaim
  /** True if Provenator would recommend this package (OSV-clean, not deprecated). */
  recommended: boolean
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
  const provenance: ProvenatorProvenance[] = [facts.provenance]
  if (osv) provenance.push(osv.provenance)

  const warnings: string[] = []
  let recommended = true

  // ── OSV gate (security-first) ──────────────────────────────────────────────
  if (osvError) {
    // Fail CLOSED: an unverifiable security posture is not a green light.
    recommended = false
    warnings.push(`OSV not verifiable (${osvError}) — not recommended until security is confirmed`)
  } else if (osv && !osv.clean) {
    recommended = false
    const ids = osv.vulns.map((v) => v.id).slice(0, 5).join(', ')
    warnings.push(`KNOWN VULNERABILITIES (OSV): ${ids}${osv.vulns.length > 5 ? ` +${osv.vulns.length - 5}` : ''} — NOT recommended`)
  }

  // ── Registry negative signals ──────────────────────────────────────────────
  if (facts.deprecated) {
    recommended = false
    warnings.push(`deprecated package: ${facts.deprecated.slice(0, 120)}`)
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

  // ── Fact vs belief: a twin proof promotes to FACT (ground truth, Tier D) ────
  let epistemic: ProvenatorClaim['epistemic'] = 'belief'
  if (twin?.proved) {
    epistemic = 'fact'
    provenance.push({
      source: 'twin probe',
      tier: 'D',
      fetchedAt: new Date().toISOString(),
    })
  } else if (twin && twin.status !== 'skipped' && !twin.proved) {
    // The twin is a POSITIVE prover. Not reproducing does NOT make a package
    // unsafe — OSV governs safety. It just stays a BELIEF, with a note. (This
    // also avoids falsely rejecting an ESM-only or unusual-entrypoint package.)
    warnings.push(`twin did not reproduce (${twin.status}: ${twin.reason ?? ''}) — stays a belief`.trim())
  }

  let confidence = calibrateConfidence(provenance)
  // A blocked recommendation must not read as high-confidence-good.
  if (!recommended) confidence = Math.min(confidence, 0.45)

  const verStr = twin?.installedVersion ?? facts.latestVersion ?? '?'
  const statement = recommended
    ? `${facts.name}@${verStr} (${facts.ecosystem}) — ${epistemic === 'fact' ? 'reproduced in twin' : 'verified via registry+OSV'}, ${facts.license ?? 'license n/a'}`
    : `${facts.name} (${facts.ecosystem}) — NOT recommended: ${warnings.join('; ')}`

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
        twinStatus: twin?.status ?? 'not-run',
        recommended,
      },
      ...(warnings.length ? { warning: warnings.join('; ') } : {}),
    },
  }
}
