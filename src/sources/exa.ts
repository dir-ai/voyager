// Provenator Tier-C source — Exa (neural web search). A third open-web provider
// alongside Tavily (search API) and Apify (scrape actor); fanned out together so
// coverage degrades gracefully per-key. Same Tier-C posture (retrieval policy
// §5.3): every result is a LOW-trust BELIEF, capped low, injection-stripped,
// flagged "unconfirmed", cross-referenced by an A/B source or a twin before it
// can become a fact.
//
// KEY: Vault-first (provider 'exa'), env fallback PROVENATOR_EXA_KEY / EXA_API_KEY.
// No key → the source NO-OPS (returns a note), never blocks.

import { provenatorFetchJson, stripInjection } from '../http.js'
import { withGateway } from '../gateway.js'
import { resolveProvenatorKey } from '../keys.js'
import type { ProvenatorClaim, ProvenatorProvenance } from '../types.js'

const EXA_URL = 'https://api.exa.ai/search'

export interface ExaRawResult {
  title?: string
  url?: string
  text?: string
  score?: number
}
interface ExaResponse {
  results?: ExaRawResult[]
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'web'
  }
}

/**
 * PURE: map an Exa response into Provenator claims. Tier-C → 'belief', confidence
 * floored low and scaled by Exa's relevance score, content injection-stripped,
 * every claim flagged "unconfirmed". Exported for unit testing without network.
 */
export function mapExaResults(resp: ExaResponse, fetchedAt: string): ProvenatorClaim[] {
  const results = (resp.results ?? []).filter((r) => r.url && r.title)
  return results.map((r) => {
    const prov: ProvenatorProvenance = { source: `web (exa): ${safeHost(r.url!)}`, tier: 'C', url: r.url, fetchedAt }
    // Exa score is 0..1 relevance; Tier-C confidence stays in [0.2, 0.45].
    const confidence = Math.max(0.2, Math.min(0.45, 0.2 + (r.score ?? 0.4) * 0.25))
    const snippet = stripInjection(r.text ?? '').slice(0, 280)
    return {
      statement: `${stripInjection(r.title ?? '').slice(0, 140)} — ${snippet}`,
      epistemic: 'belief',
      confidence,
      provenance: [prov],
      data: { url: r.url, score: r.score ?? null },
      warning: 'Tier-C unconfirmed — cross-reference against an A/B source or the twin before trusting',
    }
  })
}

export interface ExaSearchOutcome {
  claims: ProvenatorClaim[]
  note?: string
}

/** Run an Exa neural search. No-ops (with a note) when no key. Never throws. */
export async function exaSearch(query: string, maxResults = 5): Promise<ExaSearchOutcome> {
  const key = await resolveProvenatorKey('exa')
  if (!key) {
    return { claims: [], note: 'Exa off — no key configured (provider "exa")' }
  }
  try {
    const resp = await withGateway('exa', () =>
      provenatorFetchJson<ExaResponse>(EXA_URL, {
        method: 'POST',
        headers: { 'x-api-key': key },
        body: {
          query: query.slice(0, 400),
          numResults: Math.min(Math.max(maxResults, 1), 10),
          contents: { text: { maxCharacters: 600 } },
        },
      }),
    )
    const claims = mapExaResults(resp, new Date().toISOString())
    return { claims, ...(claims.length ? {} : { note: `nessun risultato Exa per "${query.slice(0, 60)}"` }) }
  } catch (e) {
    return { claims: [], note: `Exa fallito: ${(e as Error)?.message ?? 'error'}` }
  }
}
