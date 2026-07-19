# voyager

**The verified-brief organ for coding agents.**

An AI coding agent that reaches the open internet gets a raw, unsigned,
possibly-poisoned blob and feeds it straight into its own prompt. voyager
sits in front of that: it turns a query into a **cited, confidence-scored,
OSV-gated, injection-hardened brief** — the only surface your model ever sees.

Every claim carries its provenance and a confidence signal. Package
recommendations pass a **fail-closed OSV vulnerability gate**, surface **build
provenance** (npm SLSA attestations) when present, and can be **reproduced in a
disposable twin** — install + smoke-import run inside a **hardened, rootless,
network-isolated container** (never on the host). That proves the package
installs and its entrypoint loads; it is **not** a safety proof. All fetched
text is stripped of instruction-shaped payloads (multilingual + base64 + markdown
/HTML vectors) and framed as **untrusted evidence the model must analyze, never obey**.

- **check** — is this package safe to use? Registry facts + OSV gate (fail-closed)
  + provenance/license/age supply-chain signals + optional isolated twin.
  Exit codes: **0** ok · **1** rejected (unsafe) · **2** tool/usage error (no verdict).
- **brief / retrieve** — a cited brief combining package verification, GitHub
  discovery, canonical docs, and open-web search, each cross-referenced.
- **security by construction** — one egress allowlist, https-only, streamed
  size cap, injection-strip + evidence framing. Zero-network unless you query.

CLI, library, and MCP server.

## Install

```bash
npm i @dir-ai/voyager
npx -y @dir-ai/voyager check express
```

## CLI

```bash
voyager check <name> [--ecosystem npm|pypi] [--version V] [--twin]   # exit 1 if unsafe
voyager brief "<query>" [--package name] [--discover "<intent>"] [--search "<q>"] [--docs <lib>]
voyager discover "<intent>"     # GitHub repo discovery (Tier-A)
voyager search "<query>"        # open-web search (Tier-C, needs a key)
voyager docs <library>          # canonical docs (Tier-B)
voyager doctor                  # which source keys are configured
```

`check` is a natural CI gate: fail the build if an agent picked a vulnerable,
deprecated, or non-existent dependency.

## Library

```ts
import { checkPackage, voyagerRetrieve, setKeyResolver } from 'voyager'

const v = await checkPackage({ name: 'express', ecosystem: 'npm' })
// → { verdict: 'belief' | 'fact' | 'rejected', claim, steps }  (adversarial trace)

const brief = await voyagerRetrieve('a safe date library', {
  packages: [{ name: 'date-fns', ecosystem: 'npm' }],
  discover: 'date library',
})
brief.rendered   // the injection-hardened, framed text to feed a model
brief.claims     // structured, cited, confidence-scored

// Bring your own key store (default is env vars):
setKeyResolver((provider) => mySecrets.get(provider))
```

## MCP server

```jsonc
// .mcp.json
{
  "mcpServers": {
    "voyager": { "command": "npx", "args": ["-y", "@dir-ai/voyager", "mcp"] }
  }
}
```

Tools: `check_package`, `retrieve`, `discover_repos`, `fetch_docs`.

## Docker

```bash
docker run --rm ghcr.io/dir-ai/voyager check express
docker run -i --rm ghcr.io/dir-ai/voyager mcp   # stdio MCP
```

## Tiers & trust

| Tier | Source | Base trust |
|------|--------|-----------|
| **A** | GitHub · npm · PyPI · OSV (structured facts) | high |
| **B** | canonical docs (official hosts only) | high |
| **C** | open-web search (Tavily / Exa / Apify) | low — cross-referenced before trusted |
| **D** | isolated twin (install + smoke in a container) | reproduction, not a safety proof |

Keys are optional: the Tier-A core (npm/PyPI/OSV, and GitHub unauthenticated) is
zero-key. Tier-C providers each no-op without their key. Set `GITHUB_TOKEN`,
`TAVILY_API_KEY`, etc., or inject a resolver.

## Security posture

One egress allowlist (a fixed set of public API hosts), https-only, `redirect:
error`, a **streamed** byte cap that aborts an oversized body mid-download, and
an injection-strip that removes role-hijacks / chat-template tokens / zero-width
& bidi characters, decodes-and-rescans base64, neutralizes markdown images and
HTML comments, and matches instruction payloads across several languages. The
framing is the real defense — the strip keeps it from being trivially escaped.
The twin runs the package's code **only inside a hardened, network-isolated,
read-only, non-root container**; with no container runtime it refuses to run
(returns `unsupported`) rather than execute on the host. See [SECURITY.md](./SECURITY.md).

## Cache

Idempotent Tier-A facts (npm / PyPI / OSV) are cached in-process **and** on disk
under `~/.voyager/cache` (content-addressed, TTL'd) so repeated checks are fast,
survive across runs, and lean less on the network. No secret is ever written
(auth headers are never part of a cache key or value). `VOYAGER_NO_CACHE=1`
disables it; `VOYAGER_CACHE_DIR` relocates it.

## Roadmap

deps.dev-backed multi-ecosystem facts (crates / Go / RubyGems / Packagist),
typosquatting detection, PyPI/cargo twins. Contributions welcome.

## License

MIT © dir-ai
