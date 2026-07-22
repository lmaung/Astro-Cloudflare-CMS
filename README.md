# Astro Boilerplate CMS Platform

Gate 1 implements a small end-to-end slice of the approved architecture: a
static Astro page, Hero and Rich Text block definitions, a generated schema
catalog, a React/RJSF local editor, and a validated local filesystem provider.

## Local repository pair

Clone or create the content repository as a sibling:

```text
~/Repos/
  astro-boilerplate-cms/
  astro-boilerplate-cms-content/
```

Override its location with `CONTENT_REPO_PATH` when necessary. The content
repository must contain `content-manifest.json` and `pages/home.json`.

## Commands

- `npm run dev` — run the public site and development-only local editor
- `npm run check` — regenerate and verify types/generated artifacts
- `npm test` — run schema and provider tests
- `npm run build` — create the static production site
- `npm run build:pages` — fetch the sibling content repository and build on
  Cloudflare Pages

Local saves update the sibling content file atomically and never commit it.
The production build contains no filesystem write endpoint.

Remote CMS submissions use a Cloudflare Access-protected Pages Function and
short-lived GitHub App installation token to create a draft pull request only in
the content repository. They do not modify the frontend repository or trigger a
Cloudflare Pages deployment; the published static site changes only after a
deliberate frontend deployment.

## Deployment setup

Follow [GitHub and Cloudflare Pages Setup](docs/GITHUB-CLOUDFLARE-SETUP.md) for
the repository permissions, build settings, content checkout, token policy,
secrets, and verification checklist. The current public build does not require a
GitHub personal access token.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Report suspected
vulnerabilities according to [SECURITY.md](SECURITY.md), not through public
issues.

## License

Copyright 2026 Lwin Maung.

Licensed under the [Apache License 2.0](LICENSE). The license does not grant
rights to project names, logos, or other trademarks except for customary use in
describing the origin of the software. Third-party dependencies and assets
remain subject to their own licenses.
