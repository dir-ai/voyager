// Provenator Tier-C source — Apify (web scraping / automation platform). Where
// Tavily is a search API, Apify drives ACTORS: here the `apify/rag-web-browser`
// actor (query → search → scrape → clean markdown) via the run-sync endpoint, so
// one HTTP call returns results with NO polling. Same epistemic posture as every
// Tier-C source (retrieval policy §5.3): LOW trust by construction — each result
// is a BELIEF, capped low, injection-stripped, flagged "unconfirmed", and must be
// cross-referenced by an A/B source or a twin probe before it becomes a fact.
//
// KEY: Vault-first (provider 'apify'), env fallback PROVENATOR_APIFY_KEY /
// APIFY_API_TOKEN. No key → the source NO-OPS (returns null), never blocks.
//
// NOT yet wired into the live aggregation — this is a ready, tested building
// block. Wiring it alongside Tavily in the Tier-C reach is a deliberate next step
// (Provenator owner), so runtime behavior is unchanged until then.

import { provenatorFetchJson, stripInjection } from '../http.js'
import { withGateway } from '../gateway.js'
import { resolveProvenatorKey } from '../keys.js'
import type { ProvenatorClaim, ProvenatorProvenance } from '../types.js'

// run-sync-get-dataset-items: run the actor and get its dataset rows in one call.
const APIFY_ACTOR = 'apify~rag-web-browser'
const APIFY_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`

/** A single dataset item from rag-web-browser (shape is defensive — the actor
 *  has put content under `markdown`/`text` and url/title under `metadata`). */
export interface ApifyRagItem {
  url?: string
  title?: string
  text?: string
  markdown?: string
  metadata?: { url?: string; title?: string; description?: string }
}

function pickUrl(it: ApifyRagItem): string | undefined {
  return it.url ?? it.metadata?.url
}
function pickTitle(it: ApifyRagItem): string {
  return it.title ?? it.metadata?.title ?? ''
}
function pickContent(it: ApifyRagItem): string {
  return it.markdown ?? it.text ?? it.metadata?.description ?? ''
}
function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'web'
  }
}

/**
 * PURE: map rag-web-browser dataset items into Provenator claims. Tier-C →
 * epistemic 'belief', confidence floored low and decayed by rank, content
 * injection-stripped, every claim flagged "unconfirmed". Exported so the mapping
 * is unit-testable without the network (see scripts/provenator-apify-verify.mts).
 */
export function mapApifyResults(items: ApifyRagItem[], fetchedAt: string): ProvenatorClaim[] {
  const withUrl = items.filter((it) => pickUrl(it) && (pickTitle(it) || pickContent(it)))
  return withUrl.map((it, idx) => {
    const url = pickUrl(it)!
    const prov: ProvenatorProvenance = {
      source: `web (apify): ${safeHost(url)}`,
      tier: 'C',
      url,
      fetchedAt,
    }
    // Tier-C confidence stays in [0.2, 0.4], decaying by result rank.
    const confidence = Math.max(0.2, 0.4 - idx * 0.05)
    const snippet = stripInjection(pickContent(it)).slice(0, 280)
    const title = stripInjection(pickTitle(it)).slice(0, 140)
    return {
      statement: title ? `${title} — ${snippet}` : snippet,
      epistemic: 'belief',
      confidence,
      provenance: [prov],
      data: { url, rank: idx },
      warning: 'Tier-C unconfirmed — cross-reference against an A/B source or the twin before trusting',
    }
  })
}

export interface ApifySearchOutcome {
  claims: ProvenatorClaim[]
  /** Set when the source no-opped or failed — surfaced in the brief notes. */
  note?: string
}

/**
 * Run an Apify-actor open-web search. No-ops (with a note) when no key is
 * configured. Never throws — transport/timeout failures land in `note` (the
 * run-sync call can be slower than the gateway's fetch budget; on timeout the
 * source simply degrades to a note, exactly like every other Tier-C source).
 */
export async function apifySearch(query: string, maxResults = 3): Promise<ApifySearchOutcome> {
  const key = await resolveProvenatorKey('apify')
  if (!key) {
    return { claims: [], note: 'Apify off — no key configured (provider "apify")' }
  }
  try {
    const items = await withGateway('apify', () =>
      provenatorFetchJson<ApifyRagItem[]>(APIFY_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: {
          query: query.slice(0, 400),
          maxResults: Math.min(Math.max(maxResults, 1), 5),
          outputFormats: ['markdown'],
        },
        // The rag-web-browser actor runs synchronously (search + scrape), so it
        // is far slower than a Tier-A JSON API — it needs a per-call budget well
        // above the global 8s default (which exists for fast-fail on Tier-A).
        timeoutMs: 28_000,
      }),
    )
    const claims = mapApifyResults(Array.isArray(items) ? items : [], new Date().toISOString())
    return { claims, ...(claims.length ? {} : { note: `nessun risultato Apify per "${query.slice(0, 60)}"` }) }
  } catch (e) {
    return { claims: [], note: `Apify fallito: ${(e as Error)?.message ?? 'error'}` }
  }
}
