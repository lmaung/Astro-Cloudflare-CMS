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

The published website remains static. Pages Functions provide only the
Cloudflare Access-protected admin content API.

## 1. GitHub repository configuration

Both repositories should be public with `main` as the default branch.

### Cloudflare deployment GitHub App

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

### CMS content access

The protected CMS API uses a fine-grained personal access token owned by the
site operator. This credential is separate from the Cloudflare Workers and
Pages GitHub App above and is used only for the content repository.

Create the token with:

- repository access: **Only select repositories**;
- selected repository: `Astro-Cloudflare-CMS-content` only;
- repository permissions:
  - **Contents: Read and write**;
  - **Pull requests: Read and write**;
  - **Metadata: Read-only** (automatic);
- an expiration date appropriate for the operating environment.

The Pages Function reads this encrypted token from Cloudflare, uses it only for
GitHub API requests, and never sends it to the browser. Do not grant this token
access to the frontend repository.

### Recommended repository protections

After CI exists, configure a ruleset for `main` in each repository:

- require pull requests for changes;
- require the relevant validation/build checks;
- block force pushes and branch deletion;
- require branches to be current before merge when practical.

Do not enable required checks until those checks have been added, or the initial
workflow changes may become impossible to merge.

## 2. GitHub token policy

### Current deployment

The public build does not require a token: Cloudflare can clone the public
content repository during an intentional build. The fine-grained PAT exists
only for the protected remote editor's GitHub API operations.

Use a dedicated token with the least privileges described above. Store it only
as the encrypted Cloudflare secret `GITHUB_TOKEN`. Never expose it as plaintext,
put it in a repository, or grant it access to the frontend repository.

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

## 5. Protect the admin with Cloudflare Access

Before configuring the GitHub write credential, create a Cloudflare Access
self-hosted application:

1. In Cloudflare, open **Zero Trust > Access controls > Applications**.
2. Select **Create new application**.
3. Select **Self-hosted and private**, then **Add public hostname**.
4. Select the custom hostname and add the path `/admin*`.
5. Add a second public hostname entry for the same hostname with the path
   `/api/admin/*`.
6. Add an **Allow** policy containing only the intended internal identities.
7. Save the application.
8. Test in a signed-out browser. Both paths must redirect to Cloudflare Access;
   an unauthenticated `200` from `/admin/` or application JSON from
   `/api/admin/content/home` means the paths are not protected correctly.

The two protected paths are:

- `/admin*`
- `/api/admin/*`

### Find the Access team domain

1. Open **Zero Trust > Settings**.
2. Find the account's team name and team domain.
3. Enter the complete HTTPS URL as `CLOUDFLARE_ACCESS_TEAM_DOMAIN`:

   ```text
   https://<team-name>.cloudflareaccess.com
   ```

Do not enter the website hostname or omit `https://`.

### Find the Access audience tag

1. Open **Zero Trust > Access controls > Applications**.
2. Open the self-hosted application protecting the admin.
3. Open its additional/application settings.
4. Copy **Application Audience (AUD) Tag** into
   `CLOUDFLARE_ACCESS_AUD`.

The AUD tag belongs to the Access application, not the Cloudflare account ID,
zone ID, or Pages project ID.

Add these Access values to the Pages project:

| Variable | Cloudflare type | Value |
|---|---|---|
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | Plaintext | Full `https://<team>.cloudflareaccess.com` URL |
| `CLOUDFLARE_ACCESS_AUD` | Plaintext | Application Audience (AUD) tag |

The Pages Function independently verifies the `Cf-Access-Jwt-Assertion`
signature, issuer, and audience. Missing or invalid Access configuration fails
closed; it does not fall back to an unprotected editor.

### Authenticated testing

An operator or test assistant can verify the protected editor only from the
browser session that completed the Access login. Signing in through a different
browser or private session does not share the Access cookie.

For an assisted test:

1. Open the protected admin in the designated test browser.
2. The authorized operator completes the Access login personally; passwords and
   one-time codes are never shared or recorded.
3. Verify content loading and editor behavior in that authenticated session.
4. Treat **Create content PR** as a state-changing test. Confirm it separately
   before selecting it because it creates a real content branch and draft pull
   request.

## 6. Configure the remote editor

### Store the fine-grained token

1. In the Pages project, open **Settings > Variables and Secrets > Add**.
2. Name the variable `GITHUB_TOKEN`.
3. Paste the fine-grained PAT and select **Encrypt** before saving.
4. Configure the secret separately for production and any trusted preview
   environment that needs remote writes.
5. Redeploy after adding or rotating the secret.

Never paste the token into Git, documentation, screenshots, logs, chat, or the
Personal Context Vault. Revoke and replace it immediately if it may have been
exposed.

### Complete Cloudflare variable inventory

In the Pages project, open **Settings > Variables and Secrets** and add all of
the following:

| Variable | Cloudflare type | Value |
|---|---|---|
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | Plaintext | Full `https://<team>.cloudflareaccess.com` URL from Zero Trust settings |
| `CLOUDFLARE_ACCESS_AUD` | Plaintext | AUD tag from the protected Access application |
| `GITHUB_TOKEN` | **Encrypted secret** | Fine-grained PAT scoped only to the content repository |
| `GITHUB_CONTENT_OWNER` | Plaintext | `lmaung` |
| `GITHUB_CONTENT_REPO` | Plaintext | `Astro-Cloudflare-CMS-content` |
| `GITHUB_CONTENT_BRANCH` | Plaintext | `main` |

The three `GITHUB_CONTENT_*` values are fixed deployment configuration rather
than generated credentials:

- `GITHUB_CONTENT_OWNER` is the GitHub account that owns the content repository.
- `GITHUB_CONTENT_REPO` is the exact repository name, preserving capitalization.
- `GITHUB_CONTENT_BRANCH` is the branch the editor reads and targets with draft
  pull requests.

Then:

1. Configure preview and production separately; do not expose production write
   credentials to untrusted preview branches.
2. Redeploy after adding or rotating a secret.
3. Open the protected admin and verify that loading content succeeds.

A remote save validates the content again on the server, checks the expected
blob revision, creates an isolated `cms/<change-id>` branch, and opens a draft
pull request against the content repository. It never writes to the frontend
repository and never calls a Cloudflare deploy hook.

Never put secrets under `vars` in a committed Wrangler file. Local secrets must
use an ignored `.dev.vars` file; `.dev.vars*` and `.env*` are ignored by this
repository.

## 7. Verification checklist

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
- [ ] `/admin*` and `/api/admin/*` require Cloudflare Access.
- [ ] The CMS token can access only the content repository.
- [ ] A CMS save creates a draft pull request in the content repository.
- [ ] A CMS content save does not create a frontend commit or Pages deployment.
- [ ] The GitHub PAT is encrypted in Cloudflare and absent from both repositories.
- [ ] Production admin/API routes are protected by Cloudflare Access before
      remote writes are enabled.

## 8. Troubleshooting

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

### Editor says it is not configured

Confirm all Access and GitHub variables in sections 5 and 6 are present in the
active Pages environment, then redeploy.

### Editor reports authorization denied

Confirm the Access application covers both the admin page and API path, the team
domain includes `https://`, and the configured AUD tag belongs to that Access
application.

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
- Cloudflare Access JWT validation:
  https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Cloudflare Access application paths:
  https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- Cloudflare Zero Trust team domain:
  https://developers.cloudflare.com/cloudflare-one/faq/getting-started-faq/
- GitHub fine-grained PAT management:
  https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- GitHub fine-grained PAT permissions:
  https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
