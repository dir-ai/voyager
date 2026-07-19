// Provenator Tier-B source — clean-fetch FALLBACK to Context7. When Context7 has no
// entry, fetch the canonical doc page directly — but ONLY from the curated
// PROVENATOR_DOC_ALLOWLIST of official documentation hosts (enforced by the egress
// guard in http.ts). Read-only GET, injection-stripped, size-capped. The long
// tail of blogs is NOT here — that's Tier-C search.

import { provenatorFetchText, stripInjection } from '../http.js'
import { withGateway } from '../gateway.js'
import { PROVENATOR_DOC_ALLOWLIST } from '../config.js'
import type { ProvenatorClaim, ProvenatorProvenance } from '../types.js'

/** PURE: build a Tier-B claim from a fetched (already injection-stripped) doc. */
export function mapDocToClaim(url: string, text: string): ProvenatorClaim {
  let host = 'docs'
  try { host = new URL(url).hostname } catch { /* keep default */ }
  const prov: ProvenatorProvenance = { source: `docs: ${host}`, tier: 'B', url, fetchedAt: new Date().toISOString() }
  const excerpt = stripInjection(text).replace(/\s+/g, ' ').trim().slice(0, 600)
  return {
    statement: `${host} (doc ufficiale) — ${excerpt}`,
    epistemic: 'belief',
    confidence: 0.78,
    provenance: [prov],
    data: { url, host, chars: text.length },
  }
}

export interface DocsOutcome {
  claims: ProvenatorClaim[]
  note?: string
}

/** Is this URL's host on the curated official-docs allowlist? */
export function isOfficialDocUrl(url: string): boolean {
  try {
    return PROVENATOR_DOC_ALLOWLIST.has(new URL(url).hostname.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Clean-fetch a canonical doc page from an OFFICIAL host. Refuses (with a note)
 * any URL off the curated doc allowlist — defense in depth above the egress
 * guard. Never throws.
 */
export async function fetchDocUrl(url: string): Promise<DocsOutcome> {
  if (!isOfficialDocUrl(url)) {
    return { claims: [], note: `doc URL fuori allowlist ufficiale: ${url.slice(0, 80)}` }
  }
  try {
    const text = await withGateway('docs', () => provenatorFetchText(url))
    if (!text.trim()) return { claims: [], note: `doc vuoto: ${url.slice(0, 80)}` }
    return { claims: [mapDocToClaim(url, text)] }
  } catch (e) {
    return { claims: [], note: `clean-fetch fallito: ${(e as Error)?.message ?? 'error'}` }
  }
}
