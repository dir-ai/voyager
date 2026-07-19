// Voyager Tier-C source — Tavily web search. This is the OPEN-WEB reach: the
// long tail beyond structured APIs and canonical docs. Tier C is LOW trust by
// construction (retrieval policy §5.3) — every result is a BELIEF, capped low,
// injection-stripped, and must be cross-referenced by an A/B source or a twin
// probe before it can be trusted as a fact. Voyager never lets a raw Tier-C
// snippet reach the coder unframed.
//
// KEY: Vault-first (provider 'tavily'), env fallback VOYAGER_TAVILY_KEY /
// TAVILY_API_KEY. No key → the source NO-OPS (returns null), never blocks.

import { voyagerFetchJson, stripInjection } from '../http.js'
import { withGateway } from '../gateway.js'
import { resolveVoyagerKey } from '../keys.js'
import type { VoyagerClaim, VoyagerProvenance } from '../types.js'

const TAVILY_URL = 'https://api.tavily.com/search'

export interface TavilyRawResult {
  title?: string
  url?: string
  content?: string
  score?: number
}
interface TavilyResponse {
  results?: TavilyRawResult[]
  answer?: string | null
}

/**
 * PURE: map a raw Tavily response into Voyager claims. Tier-C → epistemic
 * 'belief', confidence floored low and scaled by Tavily's own relevance score,
 * content injection-stripped, every claim flagged "unconfirmed". Exported so the
 * mapping is unit-testable without the network.
 */
export function mapTavilyResults(resp: TavilyResponse, fetchedAt: string): VoyagerClaim[] {
  const results = (resp.results ?? []).filter((r) => r.url && r.title)
  return results.map((r) => {
    const prov: VoyagerProvenance = {
      source: `web: ${safeHost(r.url!)}`,
      tier: 'C',
      url: r.url,
      fetchedAt,
    }
    // Tavily score is 0..1 relevance; Tier-C confidence stays in [0.2, 0.45].
    const confidence = Math.max(0.2, Math.min(0.45, 0.2 + (r.score ?? 0.4) * 0.25))
    const snippet = stripInjection(r.content ?? '').slice(0, 280)
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

function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'web'
  }
}

export interface TavilySearchOutcome {
  /** Claims (possibly empty). */
  claims: VoyagerClaim[]
  /** Set when the source no-opped or failed — surfaced in the brief notes. */
  note?: string
}

/**
 * Run an open-web search. No-ops (with a note) when no key is configured.
 * Never throws — transport failures land in `note`.
 */
export async function tavilySearch(query: string, maxResults = 5): Promise<TavilySearchOutcome> {
  const key = await resolveVoyagerKey('tavily')
  if (!key) {
    return { claims: [], note: 'web search off — no Tavily key configured (provider "tavily")' }
  }
  try {
    const resp = await withGateway('tavily', () =>
      voyagerFetchJson<TavilyResponse>(TAVILY_URL, {
        method: 'POST',
        body: {
          api_key: key,
          query: query.slice(0, 400),
          max_results: Math.min(Math.max(maxResults, 1), 10),
          search_depth: 'basic',
        },
      }),
    )
    const claims = mapTavilyResults(resp, new Date().toISOString())
    return { claims, ...(claims.length ? {} : { note: `nessun risultato web per "${query.slice(0, 60)}"` }) }
  } catch (e) {
    return { claims: [], note: `ricerca web fallita: ${(e as Error)?.message ?? 'error'}` }
  }
}
