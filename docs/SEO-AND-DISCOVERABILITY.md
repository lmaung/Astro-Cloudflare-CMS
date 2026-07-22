# SEO and discoverability

The CMS keeps search and sharing metadata in validated content while the frontend owns every renderer and endpoint.

## Site identity

In **Site settings**, configure:

- the public HTTPS site URL;
- locale;
- organization name, optional logo, and official profile URLs;
- default title suffix and description.

The site URL must be the public production origin, without a path. Each page can override its title and description, provide a site-relative or HTTPS social image with required alternative text, and opt out of indexing.

## Generated metadata

The static fallback and refreshed runtime page both maintain:

- document title and description;
- canonical URL;
- robots directive;
- Open Graph metadata;
- Twitter card metadata;
- `WebSite`, `Organization`, and `WebPage` JSON-LD.

`/robots.txt` protects the administration paths and advertises `/sitemap.xml`. The sitemap contains only published, indexable pages. Both endpoints read the latest validated content through Pages Functions, so page lifecycle and `noIndex` changes do not require a frontend deployment.

## Redirects

Use **Redirects** in the admin for moved URLs. A redirect has a stable ID, source path, safe destination, status (`301`, `302`, `307`, or `308`), and query-preservation option. Validation rejects duplicate sources, self-redirects, loops, protected administration/API paths, and sources that conflict with existing page routes.

Use permanent statuses for completed migrations and temporary statuses only while a move is reversible. Redirect content is stored in `globals/redirects.json`; if the file does not exist, the library starts empty and is created on first save.

## Release verification

1. Set the real public site URL before production launch.
2. Confirm canonical and sharing URLs use that origin.
3. Confirm archived and `noIndex` pages are absent from the sitemap.
4. Confirm `/admin/` and `/api/admin/` remain disallowed in robots and protected by Cloudflare Access.
5. Test redirects with and without query strings.
6. Run `npm run build`, `npm test`, and `npm run test:lighthouse`.
