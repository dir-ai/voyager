// Voyager Tier-A source — GitHub REST API (repo + code + release search).
// Structured facts: which repos exist for an intent, their stars/activity, and
// the latest release of a given repo (the breaking-change signal).
//
// AUTH: zero-key by default — unauthenticated search works at a lower rate
// limit. A token is an OPTIONAL rate-limit boost, resolved Vault-first (provider
// 'github') with VOYAGER_GITHUB_TOKEN / GITHUB_TOKEN as a DEV env fallback.

import { voyagerFetchJson, stripInjection } from '../http.js'
import { withGateway } from '../gateway.js'
import { resolveVoyagerKey } from '../keys.js'
import type { VoyagerProvenance } from '../types.js'

async function authHeaders(): Promise<Record<string, string>> {
  const tok = await resolveVoyagerKey('github')
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
  }
}

export interface RepoHit {
  fullName: string
  description: string | null
  stars: number
  url: string
  /** ISO timestamp of the last push — an activity/maintenance signal. */
  pushedAt: string | null
  archived: boolean
}

export interface GithubSearchResult {
  hits: RepoHit[]
  provenance: VoyagerProvenance
}

interface GhRepoSearchResponse {
  items?: Array<{
    full_name?: string
    description?: string | null
    stargazers_count?: number
    html_url?: string
    pushed_at?: string | null
    archived?: boolean
  }>
}

/** Search repositories for an intent, ranked by stars. Bounded result count. */
export async function githubRepoSearch(intent: string, limit = 5): Promise<GithubSearchResult> {
  const q = encodeURIComponent(intent.slice(0, 200))
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${Math.min(limit, 10)}`
  const headers = await authHeaders()
  const json = await withGateway('github', () => voyagerFetchJson<GhRepoSearchResponse>(url, { headers }))
  const hits: RepoHit[] = (json.items ?? []).map((r) => ({
    fullName: r.full_name ?? '',
    // Repo descriptions are OWNER-CONTROLLED text: sanitize at ingestion so the
    // structured claims (brief.claims JSON, MCP output) never carry a raw
    // injection payload — not only the rendered/framed surface.
    description: r.description ? stripInjection(r.description) : null,
    stars: r.stargazers_count ?? 0,
    url: r.html_url ?? '',
    pushedAt: r.pushed_at ?? null,
    archived: r.archived ?? false,
  }))
  return {
    hits,
    provenance: {
      source: 'GitHub API',
      tier: 'A',
      url: `https://github.com/search?q=${q}&type=repositories`,
      fetchedAt: new Date().toISOString(),
    },
  }
}

export interface ReleaseFacts {
  tag: string | null
  name: string | null
  publishedAt: string | null
  /** Release notes body — the breaking-change source. Truncated + untrusted. */
  body: string | null
  url: string | null
  provenance: VoyagerProvenance
}

interface GhReleaseResponse {
  tag_name?: string
  name?: string | null
  published_at?: string | null
  body?: string | null
  html_url?: string | null
}

/**
 * Latest release of `owner/repo` — the breaking-change checkpoint the retrieval
 * policy requires before suggesting an upgrade. `body` is untrusted content and
 * must be injection-stripped by the caller before reaching a model.
 */
export async function githubLatestRelease(owner: string, repo: string): Promise<ReleaseFacts> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`
  const headers = await authHeaders()
  const json = await withGateway('github', () => voyagerFetchJson<GhReleaseResponse>(url, { headers }))
  return {
    tag: json.tag_name ?? null,
    name: json.name ?? null,
    publishedAt: json.published_at ?? null,
    body: (json.body ?? '').slice(0, 2000) || null,
    url: json.html_url ?? null,
    provenance: {
      source: 'GitHub API',
      tier: 'A',
      url: json.html_url ?? `https://github.com/${owner}/${repo}/releases`,
      fetchedAt: new Date().toISOString(),
    },
  }
}
