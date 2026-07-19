# Releasing voyager

Cold-start runbook for maintainers (human or AI). **No secrets are stored
anywhere** — every credential is cached on the workstation or minted by CI via
OIDC.

## Coordinates

| What | Where |
|---|---|
| Canonical working copy | `C:\Users\dir\psx-projects\psx-voyager` |
| Git remote | `https://github.com/dir-ai/voyager` (branch `main`) |
| npm package | `voyager` (unscoped, MIT) |
| MCP registry name | `io.github.dir-ai/voyager` (`server.json`) |
| Container image | `ghcr.io/dir-ai/voyager` (`:X.Y.Z` + `:latest`) |
| CI | `.github/workflows/ci.yml` (every push) + `publish.yml` (on `v*` tag) |

## Auth model — why nothing is stored

- **git push** → Git Credential Manager already holds the GitHub credential.
- **npm publish** → OIDC trusted publishing (npmjs.com trusts this repo's
  Actions workflow). CI publishes with `--provenance`; no npm token exists.
- **MCP registry** → `mcp-publisher login github-oidc` in CI.
- **GHCR** → the ephemeral `GITHUB_TOKEN`.

If a step asks for a password/token, stop — check the Trusted Publisher config
on npmjs.com instead of minting a credential.

## First-publish (one-time, done by the account owner)

1. Create the GitHub repo `dir-ai/voyager`, push `main`.
2. On npmjs.com, once the name is claimed, add the **Trusted Publisher**:
   repository `dir-ai/voyager`, workflow `publish.yml`.
3. Enable 2FA "Authorization and Publishing" on the npm account (authenticator).
   From then on, CI publishes with no interactive step.

## Every release

1. Change + tests: `npm test` (all suites green — check/gate/injection-strip + MCP stdio).
2. Bump `version` in **`package.json` and `server.json`** (`.version` +
   `.packages[0].version`).
3. Commit on `main`, then:
   ```bash
   git tag vX.Y.Z && git push origin main && git push origin vX.Y.Z
   ```
4. CI does the rest: npm publish (provenance) → MCP registry → Docker build +
   in-container verify smoke → multi-arch GHCR push.

## Verify each release

```bash
npm view voyager version              # X.Y.Z (CDN can lag 1–2 min)
npx -y @dir-ai/voyager@X.Y.Z verify some.ts   # real-user smoke
```
- Actions green: https://github.com/dir-ai/voyager/actions
- Image: https://github.com/dir-ai/voyager/pkgs/container/voyager

## Conventions

- Straight to `main`; tags only for releases.
- NodeNext ESM: every relative import carries a `.js` extension. The shebang in
  `src/cli.ts` / `src/mcp.ts` is preserved by `tsc`.
- Zero-network core: never add a network call; it's a SECURITY.md promise.
