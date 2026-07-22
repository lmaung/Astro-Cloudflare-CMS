# Astro Boilerplate CMS Platform

Gate 3 provides an end-to-end multi-page CMS: validated page creation,
archive/restore lifecycle, page metadata and SEO, ordered page blocks, global
settings, ordered navigation, direct Git-backed publishing, and runtime page
refreshes without frontend deployments.

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
- `npm run test:e2e` — run desktop/mobile browser workflows and axe checks
- `npm run build` — create the static production site
- `npm run build:pages` — fetch the sibling content repository and build on
  Cloudflare Pages

Local saves update the sibling content file atomically and never commit it.
The production build contains no filesystem write endpoint.

Remote CMS saves use a Cloudflare Access-protected Pages Function and a
fine-grained GitHub token scoped only to the content repository. Validated data
is committed atomically to the content branch with its validation artifact. The
frontend repository is never modified and Cloudflare is not redeployed.

The public site keeps its static home build as a resilient fallback, then
fetches the requested slug's latest validated content through a read-only Pages
Function on each refresh. Cloudflare Pages' static SPA fallback lets newly
created slugs resolve through the existing deployment. Registered blocks,
ordering, visibility, navigation, page metadata, and settings can therefore
change without a frontend build; executable application code remains
frontend-only.

## Page lifecycle

- **Create and publish:** Pages receive a permanent safe slug and an initial
  registered block. Add their URL to Navigation when they should appear in the
  primary menu.
- **Edit:** Page title, SEO fields, block content, block visibility, and block
  order are schema validated before a direct content commit.
- **Remove:** Pages are archived, not erased. The home page cannot be archived,
  and navigation references must be removed before another page is archived.
- **Restore:** Archived pages can be published again from the Pages workspace.
- **Reorder:** Navigation array order controls menu order; it does not control
  page identity or prevent unlisted landing pages.

## Deployment setup

Follow [GitHub and Cloudflare Pages Setup](docs/GITHUB-CLOUDFLARE-SETUP.md) for
the repository permissions, build settings, content checkout, token policy,
secrets, and verification checklist. The token is used only by the protected
remote editor; the public build does not require it.

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
