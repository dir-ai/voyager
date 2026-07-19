# voyager

**The verified-brief organ for coding agents.**

An AI coding agent that reaches the open internet gets a raw, unsigned,
possibly-poisoned blob and feeds it straight into its own prompt. voyager
sits in front of that: it turns a query into a **cited, confidence-scored,
OSV-gated, injection-safe brief** — the only surface your model ever sees.

Every claim carries its provenance and a calibrated confidence. Package
recommendations pass a **fail-closed OSV vulnerability gate** and can be
**reproduced in a disposable twin** (install + smoke) to promote a *belief*
into a twin-proved *fact*. All fetched text is stripped of instruction-shaped
payloads and framed as **untrusted evidence the model must analyze, never obey**.

- **check** — is this package safe to use? Registry facts + OSV gate (fail-closed)
  + license/age supply-chain signals + optional twin reproduction. Exit 1 if not.
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
brief.rendered   // the injection-safe, framed text to feed a model
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
| **D** | twin proof (install + smoke) | ground truth |

Keys are optional: the Tier-A core (npm/PyPI/OSV, and GitHub unauthenticated) is
zero-key. Tier-C providers each no-op without their key. Set `GITHUB_TOKEN`,
`TAVILY_API_KEY`, etc., or inject a resolver.

## Security posture

One egress allowlist (a fixed set of public API hosts), https-only, `redirect:
error`, a **streamed** byte cap that aborts an oversized body mid-download, and
an injection-strip that removes role-hijacks / chat-template tokens / zero-width
& bidi characters and neutralizes attempts to spoof the evidence frame. The
framing is the real defense — the strip keeps it from being trivially escaped.
The twin is opt-in and installs with `--ignore-scripts`. See [SECURITY.md](./SECURITY.md).

## Roadmap

deps.dev-backed multi-ecosystem facts (crates / Go / RubyGems / Packagist),
typosquatting detection, PyPI/cargo twins. Contributions welcome.

## License

MIT © dir-ai
