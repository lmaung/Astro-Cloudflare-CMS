# Gate 5 template validation

Validated: 2026-07-22

Gate 5 created an isolated second frontend/content pair from local clean clones, changed its identity to **Northstar Studio**, applied the current frontend candidate as an upgrade, and verified the content boundary and output. The throwaway pair lived outside both working repositories and contained no credentials.

## Measurements

| Operation                         | Result                 | Wall time |
| --------------------------------- | ---------------------- | --------: |
| Clone frontend                    | Pass                   |    0.08 s |
| Clone content                     | Pass                   |    0.03 s |
| Clean baseline dependency install | Pass, zero advisories  |    1.87 s |
| Baseline content validation       | Pass                   |    0.18 s |
| Baseline production build         | Pass, zero diagnostics |    4.39 s |
| Apply candidate frontend upgrade  | Pass                   |    0.04 s |
| Candidate dependency install      | Pass                   |    2.89 s |
| Customized content validation     | Pass                   |    0.47 s |
| Customized production build       | Pass, zero diagnostics |    4.51 s |

Times are local observations, not service-level guarantees.

## Portability evidence

- The second content repository remained content/configuration only; executable code stayed in the frontend clone.
- `CONTENT_REPO_PATH=../second-site-content` supported independently named repository pairs.
- Site identity, locale, organization, page title, descriptions, body content, action labels, and footer copyright changed without modifying application code.
- Generated HTML contained the new brand, canonical origin, Open Graph and Twitter metadata, and `WebSite`/`Organization`/`WebPage` structured data.
- Validation rejected stale generated page evidence until its digest matched the changed content.
- No frontend commit, push, deploy hook, or redeployment was triggered by content changes.

## Defects found and resolved

1. A nonstandard sibling content name fails without configuration. This is intentional but easy to miss; the setup and Gate 5 instructions now call out `CONTENT_REPO_PATH` explicitly.
2. Parallel first-load tests could race Vite dependency optimization. The required React/RJSF dependencies are now pre-bundled and the matrix uses file-level, bounded concurrency.
3. Lighthouse CI introduced five development-only advisories. It was replaced with maintained Lighthouse and a small local three-run budget harness; production and full dependency audits now report zero advisories.
4. Platform-suffixed screenshots could not be shared by CI. Visual references now use platform-neutral paths and are limited to deterministic Chromium targets.

## Outcome

Gate 5 passes for local setup, content validation, upgrade application, customization, and production build. CI remains responsible for the clean Linux Firefox/WebKit confirmation described in [Quality gates](QUALITY-GATES.md).
