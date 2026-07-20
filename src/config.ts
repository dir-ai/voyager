// voyager — configuration, flags, and the egress allowlist.
//
// Design constraints:
//  - ON by default (it's a tool you installed to use). Set VOYAGER_OFF=1 to
//    make every retrieve a no-op without uninstalling.
//  - The egress allowlist below is a SECURITY control (a fixed set of trusted
//    public API hosts). Every source host is enumerated; anything else is refused.
//  - Keys come from the environment (or an injected resolver — see keys.ts). The
//    core Tier-A sources are zero-key (OSV / npm / PyPI are public; GitHub works
//    unauthenticated at a lower rate limit), so a token is an optional rate-limit
//    boost, never required.

/** Master switch. On by default; VOYAGER_OFF=1 turns every retrieve into a no-op. */
export function voyagerEnabled(): boolean {
  return process.env.VOYAGER_OFF !== '1'
}

/** Opt-in for the digital-twin live-probe (npm install + smoke). Default OFF: it
 *  executes `npm install` of the queried package, so enable it ONLY on a trusted,
 *  single-tenant/local machine. Without it, package claims stay BELIEFS (still
 *  OSV-gated) instead of twin-proved FACTS. */
export function voyagerTwinEnabled(): boolean {
  return process.env.VOYAGER_TWIN === '1'
}

export const VOYAGER_TWIN_OFF_REASON =
  'proof-in-twin OFF — package not reproduced (stays a "belief" verified by OSV, not a "fact"). ' +
  'For truth-by-reproduction (install + smoke in a disposable sandbox) set VOYAGER_TWIN=1 ' +
  'ONLY on a trusted single-tenant/local machine.'

/**
 * Egress allowlist — the ONLY hosts F0 may reach. Every outbound call passes
 * through http.ts which checks this set; an unknown host is refused and logged.
 * These are public, structured Tier-A API endpoints (facts, no scraping).
 */
export const VOYAGER_EGRESS_ALLOWLIST: ReadonlySet<string> = new Set([
  'api.github.com',      // GitHub REST/search — repos, code, releases
  'registry.npmjs.org',  // npm package metadata
  'pypi.org',            // PyPI package metadata (JSON API)
  'api.osv.dev',         // OSV.dev vulnerability database
  'api.deps.dev',        // deps.dev — dependency facts (reserved for F1)
  // Tier-C web-search providers (F1) — the open-web reach. Results are LOW-trust
  // (cross-reference required) and pass through the same injection-strip + cap.
  'api.tavily.com',      // Tavily search
  'api.exa.ai',          // Exa neural search
  'api.apify.com',       // Apify actors (rag-web-browser) — scrape/extract
])

/**
 * Tier-B canonical-docs allowlist (F1, option C). The clean-fetch FALLBACK to
 * Context7: a CURATED set of OFFICIAL documentation hosts only. Read-only GET,
 * injection-stripped + size-capped like every other egress. This is the one
 * security decision behind Tier-B — keep it official-hosts-only; never widen it
 * to arbitrary blogs (that long tail is Tier-C search, not Tier-B docs).
 */
export const VOYAGER_DOC_ALLOWLIST: ReadonlySet<string> = new Set([
  'context7.com',                 // Context7 docs API (PRIMARY)
  'developer.mozilla.org',        // MDN
  'www.typescriptlang.org',       // TS Handbook
  'react.dev',
  'nextjs.org',
  'vuejs.org',
  'svelte.dev',
  'angular.dev',
  'docs.python.org',
  'go.dev',
  'doc.rust-lang.org',
  'nodejs.org',
  'modelcontextprotocol.io',      // MCP spec
  'docs.anthropic.com',
  'platform.openai.com',
  'kubernetes.io',
  'developer.hashicorp.com',      // Terraform / Vault docs
  'docs.aws.amazon.com',
  // Security-craft canon (Tier-B, same trust tier as MDN): the official pentest /
  // vulnerability references. Voyager builds security briefs — the craft library
  // must not be walled off.
  'cheatsheetseries.owasp.org',   // OWASP Cheat Sheet Series
  'owasp.org',                    // OWASP (Top 10, ASVS, testing guide)
  'portswigger.net',              // PortSwigger Web Security Academy
  'cwe.mitre.org',                // CWE — Common Weakness Enumeration
  'capec.mitre.org',              // CAPEC — Common Attack Pattern Enumeration
])

/** Is this host allowed for egress? Tier-A/C API hosts OR Tier-B doc hosts. */
export function isEgressAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return VOYAGER_EGRESS_ALLOWLIST.has(h) || VOYAGER_DOC_ALLOWLIST.has(h)
}

/** Per-call network budget. Kept tight — Tier-A APIs are fast JSON. */
export const VOYAGER_FETCH_TIMEOUT_MS = 8_000
/** Hard cap on a fetched response body — a structured fact is small; anything
 *  huge is either an attack or the wrong endpoint. */
export const VOYAGER_MAX_RESPONSE_BYTES = 512 * 1024
