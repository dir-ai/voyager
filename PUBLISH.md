# Publishing voyager — first-publish checklist (account owner)

Everything in this package is built, tested (20 green), and staged on a local
`main`. These are the one-time, account-gated steps that only you can do — the
same flow we used for Repotector. After this, CI publishes every release with
no interactive step.

## 1. Create the GitHub repo
- New repo **`dir-ai/voyager`**, public, no template.
- Then, from `C:\Users\dir\psx-projects\psx-voyager`:
  ```bash
  git remote add origin https://github.com/dir-ai/voyager.git
  git push -u origin main
  ```
  (Claude can run the push once the repo exists — the credential is cached.)

## 2. npm — claim the name + Trusted Publisher
- Sign in to npmjs.com. The name `voyager` is currently free (verify: it 404s).
- After the first publish claims it (CI does that on the tag), add the
  **Trusted Publisher** under the package's *Settings*:
  - Repository: `dir-ai/voyager`
  - Workflow: `publish.yml`
- Enable **2FA → Authorization and Publishing** (authenticator app). This is the
  step email OTP can't cover; it's why the first publish needs you.

> Order note: OIDC trusted publishing needs the package to exist first OR the
> "pending publisher" flow. If the very first `npm publish` 403s because the
> name isn't claimed under your account yet, do one manual `npm publish` locally
> (`npm run build && npm publish --access public`) to claim it, then wire the
> Trusted Publisher so all future releases are hands-off. This mirrors exactly
> what we did for Repotector.

## 3. Tag the release
```bash
git tag v1.0.0 && git push origin v1.0.0
```
CI (`publish.yml`) then: npm publish `--provenance` → MCP registry (github-oidc)
→ Docker build + in-container derive smoke → multi-arch GHCR push. All via OIDC
/ `GITHUB_TOKEN` — no stored secrets.

## 4. Verify
```bash
npm view voyager version                     # 1.0.0 (CDN can lag 1–2 min)
npx -y @dir-ai/voyager@1.0.0 check express      # real-user smoke
```
- Actions green: https://github.com/dir-ai/voyager/actions
- Image: https://github.com/dir-ai/voyager/pkgs/container/voyager
- First GHCR package may default to private — flip it to public once in the
  package settings (one time).

See [RELEASING.md](./RELEASING.md) for the ongoing per-release flow.
