# Authentication and role authorization

GitHub is the only persistence layer. Cloudflare Access authenticates a person,
the content repository stores users and roles in `globals/authorization.json`,
and each page stores its policy in `access.readRoles` and
`access.writeRoles`.

## Repository privacy requirement

`globals/authorization.json` contains user email addresses. Every customer or
production site's cloned content repository **must be private before any user
identity is added**. This is a mandatory deployment rule, not a recommendation.

The public reference repository may contain only owner-approved demo identities
whose inboxes remain under the demo operator's control. Demo records must never
be copied into a customer clone; replace them before deployment.

The frontend repository remains application-only. Authorization data, content,
configuration, media metadata, and validation artifacts stay in the content
repository.

## Permission model

```json
{
  "access": {
    "readRoles": ["member", "editor", "admin"],
    "writeRoles": ["page-editor", "admin"]
  }
}
```

Roles are additive and write access implies read access. `public` is implicit
for everyone, and `authenticated` is implicit after a valid Cloudflare Access
login. The reserved role keys are `public`, `authenticated`, `member`,
`editor`, `page-editor`, and `admin`. Administrators may create additional
roles in **Admin > Users and roles**.

The home page must remain readable by `public`. Other protected pages are served
at `/members/<slug>` and excluded from anonymous snapshots, public navigation,
robots indexing, and the sitemap.

## Authorization file

The site-specific content repository contains:

```json
{
  "roles": [
    {
      "key": "member",
      "name": "Member",
      "description": "May read member content.",
      "system": true
    }
  ],
  "users": [
    {
      "email": "person@example.com",
      "displayName": "Example Person",
      "roles": ["member"]
    }
  ]
}
```

Admin saves validate this file and commit it directly to the configured content
branch with `_validation/globals/authorization.json`. Optimistic concurrency
prevents one administrator from silently replacing a newer version. No frontend
commit, deployment, or database write occurs.

## Cloudflare Access applications

Create two self-hosted Access applications on the same site hostname.

### Admin application

Protect `/admin*` and `/api/admin/*`. Allow only administrators and store its
Audience (AUD) tag as `CLOUDFLARE_ACCESS_AUD`.

Cloudflare Access remains the outer admin gate. A GitHub `admin` role does not
bypass that Access policy.

### Members application

Protect both `/members/*` and `/api/content/protected-snapshot*` in one
application so the paths share an audience. Store its AUD tag as
`CLOUDFLARE_MEMBER_ACCESS_AUD`.

The protected content function verifies the Access email, loads the current
authorization file from GitHub, and applies the page policy. Authentication
alone grants only the implicit `authenticated` role.

## Required production configuration

| Name                            | Type                 | Purpose |
| ------------------------------- | -------------------- | ------- |
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | Plaintext            | Full Access team URL |
| `CLOUDFLARE_ACCESS_AUD`         | Plaintext            | Admin application AUD |
| `CLOUDFLARE_MEMBER_ACCESS_AUD`  | Plaintext            | Members application AUD |
| `GITHUB_TOKEN`                  | Encrypted secret     | Fine-grained content-repository token |
| `GITHUB_CONTENT_OWNER`          | Plaintext            | Content repository owner |
| `GITHUB_CONTENT_REPO`           | Plaintext            | Private content repository name |
| `GITHUB_CONTENT_BRANCH`         | Plaintext            | Content branch, normally `main` |

No D1, KV, R2, or external database binding is required.

## Admin workflow

1. Make the customer/site-specific content repository private. Do not continue
   with real user provisioning while it is public.
2. Open **Users and roles**.
3. Add custom roles if needed.
4. Add users using the same email returned by the Cloudflare Access identity
   provider and assign their roles.
5. Set each page's read and write roles in **Pages**.
6. Save. Refresh the protected page to verify the new policy without a frontend
   deployment.

Microsoft, Google, GitHub, and other Access identity providers can be added
later as long as their verified email claim matches the stored assignment.
