# GitHub and Cloudflare Pages Setup

This runbook is the canonical setup guide for the Astro Cloudflare CMS
repository pair.

Last verified: 2026-07-21

## Architecture at a glance

| Role | GitHub repository | Local path |
|---|---|---|
| Frontend, admin, schemas, build, Functions | `lmaung/Astro-Cloudflare-CMS` | `~/Repos/astro-boilerplate-cms` |
| Content, configuration, and media only | `lmaung/Astro-Cloudflare-CMS-content` | `~/Repos/astro-boilerplate-cms-content` |

Cloudflare Pages connects to the **frontend repository only**. During a Pages
build, `npm run build:pages` checks out the content repository as a sibling and
then runs the normal static build.

The published website remains static. Pages Functions will later provide only
the protected admin write API.

## 1. GitHub repository configuration

Both repositories should be public with `main` as the default branch.

### Cloudflare GitHub App

Install or configure the **Cloudflare Workers and Pages** GitHub App and grant it
access only to repositories Cloudflare needs to build. The frontend repository
must be selected. Access to the content repository is harmless but is not
required for the current public read during a Pages build.

GitHub location:

1. Open **Settings**.
2. Open **Applications**.
3. Open **Installed GitHub Apps**.
4. Configure **Cloudflare Workers and Pages**.
5. Prefer **Only select repositories**.

The GitHub App supplies Cloudflare's source/build integration. A personal access
token is not required for this connection.

### Recommended repository protections

After CI exists, configure a ruleset for `main` in each repository:

- require pull requests for changes;
- require the relevant validation/build checks;
- block force pushes and branch deletion;
- require branches to be current before merge when practical.

Do not enable required checks until those checks have been added, or the initial
workflow changes may become impossible to merge.

## 2. GitHub token policy

### Current deployment: no PAT required

The repositories are public. Cloudflare can clone the content repository for a
build without authentication, and its installed GitHub App handles the frontend
source integration. Do not create a PAT merely for Pages auto-deployment.

If the two `astro-cms` fine-grained tokens shown during initial setup have no
expiration and have never been used, delete them. They are not needed for the
current build.

### Temporary remote-write evaluation

The approved long-term design uses a GitHub App with short-lived installation
tokens. If a fine-grained PAT is temporarily used to prove the CMS write path,
create **one** token—not two—with:

- resource owner: `lmaung`;
- repository access: only `Astro-Cloudflare-CMS-content`;
- expiration: 30 days preferred, 90 days maximum for an active evaluation;
- repository permissions:
  - **Contents: Read and write**;
  - **Pull requests: Read and write**;
  - **Metadata: Read-only** (automatically included by GitHub).

Do not grant Administration, Actions, Workflows, Secrets, Pages, or access to the
frontend repository. The CMS edits content; it does not edit platform code.

Store a temporary token in Cloudflare as an encrypted secret named
`GITHUB_CONTENT_TOKEN`. Never store the token in Git, project documentation,
build logs, screenshots, the Personal Context Vault, plaintext environment
variables, or browser code. Do not create or upload the token until a Pages
Function actually consumes it.

## 3. Create the Cloudflare Pages project

Use **Pages**, not a Worker application:

1. In Cloudflare, open **Workers & Pages**.
2. Select **Create application**.
3. Select the **Pages** path. If the screen initially says “Create a Worker,”
   use the **Looking to deploy Pages? Get started** link.
4. Select **Connect to Git** / **Continue with GitHub**.
5. Choose `lmaung/Astro-Cloudflare-CMS`.

Use these build settings:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | Astro, or None if entered manually |
| Root directory | `/` (repository root) |
| Build command | `npm run build:pages` |
| Build output directory | `dist` |
| Node version | `22.16.0`, controlled by `.node-version` |

The Pages v3 build image currently defaults to Node 22.16.0. The checked-in
`.node-version` prevents an unnoticed runtime change and satisfies Astro's
minimum Node requirement.

### Non-secret build variables

The default values are already correct for these public repositories. They may
be overridden in **Settings > Variables and Secrets** when needed:

| Variable | Default | Purpose |
|---|---|---|
| `CONTENT_REPO_URL` | `https://github.com/lmaung/Astro-Cloudflare-CMS-content.git` | Content clone URL |
| `CONTENT_REF` | `main` | Branch, tag, or exact commit SHA to build |
| `CONTENT_REPO_PATH` | `../astro-boilerplate-cms-content` | Sibling checkout path |

For a reproducible production release, set `CONTENT_REF` to an exact content
commit SHA. Using `main` is acceptable during the initial evaluation but makes a
rebuild depend on the newest content rather than the originally deployed input.

## 4. Automatic deployment behavior

The Cloudflare Git integration automatically builds:

- production when `main` changes in the frontend repository;
- previews when an eligible frontend branch or pull request changes.

It does **not** automatically rebuild the frontend Pages project when only the
separate content repository changes. This is the current intentional policy:

- saving or publishing CMS data writes only to the content repository;
- a content save must not push, commit, or otherwise modify the frontend
  repository;
- a content save must not invoke a Cloudflare deploy hook or trigger a frontend
  redeployment;
- the deployed static site continues to show the content from its last build
  until an operator deliberately deploys the frontend.

A future decision may introduce automatic content-triggered deployments, but
that behavior is out of scope until explicitly approved.

Do not copy content into the frontend repository merely to trigger a build.

## 5. Cloudflare secrets

When the remote-write Pages Function exists:

1. Open the Pages project.
2. Go to **Settings > Variables and Secrets**.
3. Select **Add**.
4. Enter the required secret name.
5. Select **Encrypt** before saving.
6. Configure preview and production separately; do not expose production write
   credentials to untrusted preview branches.
7. Redeploy after adding or rotating a secret.

Never put secrets under `vars` in a committed Wrangler file. Local secrets must
use an ignored `.dev.vars` file; `.dev.vars*` and `.env*` are ignored by this
repository.

## 6. Verification checklist

After configuration, verify:

- [ ] GitHub shows the Cloudflare Workers and Pages App with least-privilege
      repository selection.
- [ ] The Pages project source is `lmaung/Astro-Cloudflare-CMS`.
- [ ] Production branch is `main`.
- [ ] Build command is `npm run build:pages`.
- [ ] Output directory is `dist`.
- [ ] Build logs show the content repository ref being fetched during an
      intentional frontend deployment.
- [ ] Build logs show zero Astro/TypeScript diagnostics.
- [ ] The deployed Home page contains content from the content repository.
- [ ] A frontend pull request receives a Pages preview URL.
- [ ] A CMS content save does not create a frontend commit or Pages deployment.
- [ ] No PAT is present unless a deployed write Function actively needs it.
- [ ] Any temporary PAT has a short expiration and content-repository-only scope.
- [ ] Production admin/API routes are protected by Cloudflare Access before
      remote writes are enabled.

## 7. Troubleshooting

### Cloudflare cannot see the frontend repository

From the Pages project, go to **Settings > Builds**, select **Manage** beside the
Git repository, and review or reinstall the Cloudflare GitHub App. Confirm that
`Astro-Cloudflare-CMS` is selected in the app installation.

### Build succeeds but shows fallback content

Confirm the build command is `npm run build:pages`, not `npm run build`. Check
the logs for “Fetching content repository ref” and confirm the content manifest
and `pages/home.json` exist at `CONTENT_REF`.

### Content changes do not deploy

This is expected and intentional. The deployed static site remains on the
content revision from its last build. Start a deliberate frontend deployment
only when the updated content should be published.

### Token was exposed

Revoke or delete it in GitHub immediately, replace the affected Cloudflare
secret, and review logs and Git history. Removing a token from a later commit is
not sufficient.

## Official references

- Cloudflare Pages Git integration:
  https://developers.cloudflare.com/pages/configuration/git-integration/
- Cloudflare GitHub integration:
  https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- Cloudflare Astro Pages guide:
  https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- Cloudflare Pages build image:
  https://developers.cloudflare.com/pages/configuration/build-image/
- Cloudflare Pages secrets and bindings:
  https://developers.cloudflare.com/pages/functions/bindings/
- GitHub fine-grained PAT management:
  https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- GitHub fine-grained PAT permissions:
  https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- GitHub App best practices:
  https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app
