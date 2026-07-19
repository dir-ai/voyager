// provenator — API-key resolution. Standalone policy: keys come from the
// environment by default, or from an injectable resolver a library consumer
// provides (so a host app can wire its own secret store). A source with no key
// configured simply no-ops — a missing key is a normal state, never an error.

export type KeyProvider = 'github' | 'tavily' | 'exa' | 'apify' | 'context7'

/** Provider → ordered env-var names, checked in order. */
const ENV_VARS: Record<KeyProvider, string[]> = {
  github: ['PROVENATOR_GITHUB_TOKEN', 'GITHUB_TOKEN'],
  tavily: ['PROVENATOR_TAVILY_KEY', 'TAVILY_API_KEY'],
  exa: ['PROVENATOR_EXA_KEY', 'EXA_API_KEY'],
  apify: ['PROVENATOR_APIFY_KEY', 'APIFY_API_TOKEN', 'APIFY_TOKEN'],
  context7: ['PROVENATOR_CONTEXT7_KEY', 'CONTEXT7_API_KEY'],
}

/** A consumer-supplied resolver — return the key for a provider, or null. May be async. */
export type KeyResolver = (provider: KeyProvider) => string | null | Promise<string | null>

let injectedResolver: KeyResolver | null = null

/** Wire a custom key source (checked BEFORE env vars). Pass null to clear. */
export function setKeyResolver(resolver: KeyResolver | null): void {
  injectedResolver = resolver
}

/**
 * Resolve a source key: the injected resolver first (if any), then env vars,
 * else null. Never throws — a missing key means the source no-ops.
 */
export async function resolveProvenatorKey(provider: KeyProvider): Promise<string | null> {
  if (injectedResolver) {
    try {
      const k = await injectedResolver(provider)
      if (k && k.trim()) return k.trim()
    } catch {
      // resolver failure → fall through to env
    }
  }
  for (const name of ENV_VARS[provider]) {
    const v = process.env[name]?.trim()
    if (v) return v
  }
  return null
}
