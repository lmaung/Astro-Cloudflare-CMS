# Contributing

Thank you for considering a contribution to Astro Cloudflare CMS.

## Before opening a change

- Search existing issues and discussions before proposing substantial work.
- Open an issue before making architectural, schema, provider, or UI-foundation
  changes.
- Keep the frontend and content repository boundary strict.
- Never include secrets, credentials, private keys, customer data, or licensed
  assets that cannot be redistributed.

## Development checks

Run these commands before submitting a pull request:

```sh
npm test
npm run check
npm run build
```

UI changes must meet WCAG AA, remain keyboard accessible, preserve visible
focus, support reduced motion, use semantic design tokens, and work at supported
responsive widths.

## Contribution license

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this project is provided under the Apache License 2.0, as
described in section 5 of that license. You confirm that you have the right to
submit the contribution under those terms.
