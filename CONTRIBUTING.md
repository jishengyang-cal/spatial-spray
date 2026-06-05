# Contributing

Spatial Spray separates Linux-runnable product validation from Apple-required native execution. Contributions should keep identity, location, moderation, AR, and native build boundaries explicit.

## Contribution workflow

1. Identify whether the change affects contracts, API behavior, brush engine, web simulator, moderation, native Apple source, Mac Builder workflow, or docs.
2. Keep dev-mode provider login separate from production provider token verification.
3. Do not claim browser simulator behavior is equivalent to ARKit or Vision Pro device behavior.
4. Update docs and tests when a product rule or workflow changes.
5. Run the relevant verification before opening a pull request.

## Local verification

```bash
pnpm install
pnpm workflow:check
pnpm test
```

For documentation-site changes:

```bash
node --check docs-site/assets/app.js
python3 -m http.server 4173 --directory docs-site
```

## Pull request expectations

- Explain the product or workflow boundary that changed.
- List affected packages, services, scripts, native files, or docs.
- Include verification output or explain why a check is not applicable.
- Do not include signing assets, credentials, API keys, certificates, provisioning profiles, private user data, or precise sensitive locations.

