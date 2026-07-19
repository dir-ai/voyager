// Provenator Tier-B source — Context7 (PRIMARY canonical-docs consumer). Context7
// indexes official library docs and serves them as clean text by library id, so
// Provenator gets authoritative, version-aware docs through ONE allowlisted host
// (context7.com) instead of scraping N doc sites. Tier-B = authoritative (high
// trust); still injection-stripped + framed as evidence, never instructions.
//
// KEY: Vault-first, FAIL-CLOSED (lead directive: "key dal Vault, zero hardcode,
// fail-closed se la key manca"). No Context7 key configured (Vault provider
// 'context7', env PROVENATOR_CONTEXT7_KEY as dev fallback) → Context7 is SKIPPED
// with a note, and the caller degrades to the clean-fetch doc fallback. The key
// is sent only to context7.com, never logged, never on any other path.

import { provenatorFetchJson, provenatorFetchText, stripInjection } from '../http.js'
import { withGateway } from '../gateway.js'
import { resolveProvenatorKey } from '../keys.js'
import type { ProvenatorClaim, ProvenatorProvenance } from '../types.js'

interface C7SearchResult {
  results?: Array<{ id?: string; title?: string; description?: string; totalTokens?: number }>
}

/** PURE: build a Tier-B claim from a resolved Context7 library + its docs text. */
export function mapContext7Claim(libraryId: string, title: string, docs: string): ProvenatorClaim {
  const prov: ProvenatorProvenance = {
    source: `Context7: ${title || libraryId}`,
    tier: 'B',
    url: `https://context7.com${libraryId}`,
    fetchedAt: new Date().toISOString(),
  }
  // Defense in depth: strip even if the caller passed raw text (the fetch path
  // already strips, but a pure mapper must never emit instruction-shaped text).
  const excerpt = stripInjection(docs).replace(/\s+/g, ' ').trim().slice(0, 600)
  return {
    statement: `${title || libraryId} (docs canonici) — ${excerpt}`,
    epistemic: 'belief', // authoritative, but not twin-proved → belief, high conf
    confidence: 0.8,
    provenance: [prov],
    data: { libraryId, title, docsChars: docs.length },
  }
}

export interface DocsOutcome {
  claims: ProvenatorClaim[]
  note?: string
}

/**
 * Resolve a library/topic via Context7 and fetch its canonical docs. Returns a
 * single Tier-B claim (best library match). No-ops with a note on miss/failure;
 * never throws — the caller falls back to clean-fetch.
 */
export async function context7Docs(query: string, topic?: string): Promise<DocsOutcome> {
  // FAIL-CLOSED: no Vault key → don't call Context7 at all (caller falls back).
  const key = await resolveProvenatorKey('context7')
  if (!key) {
    return { claims: [], note: 'Context7 off — no key configured (provider "context7"); using the clean-fetch fallback' }
  }
  const authHeaders = { Authorization: `Bearer ${key}` }
  try {
    const searchUrl = `https://context7.com/api/v1/search?query=${encodeURIComponent(query.slice(0, 200))}`
    const search = await withGateway('context7', () =>
      provenatorFetchJson<C7SearchResult>(searchUrl, { headers: authHeaders }),
    )
    const top = (search.results ?? []).find((r) => r.id)
    if (!top?.id) return { claims: [], note: `Context7: nessuna libreria per "${query.slice(0, 60)}"` }

    const docsUrl =
      `https://context7.com/api/v1${top.id}?type=txt&tokens=2000` +
      (topic ? `&topic=${encodeURIComponent(topic.slice(0, 80))}` : '')
    const docs = await withGateway('context7', () => provenatorFetchText(docsUrl, { headers: authHeaders }))
    if (!docs.trim()) return { claims: [], note: `Context7: docs vuoti per ${top.id}` }

    return { claims: [mapContext7Claim(top.id, top.title ?? top.id, docs)] }
  } catch (e) {
    return { claims: [], note: `Context7 fallito: ${(e as Error)?.message ?? 'error'}` }
  }
}
