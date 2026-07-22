# Agent Instructions — Astro Boilerplate CMS Platform

## Project Context

The matching Personal Context Vault project is:

`~/AI-Vault/20-Projects/astro-boilerplate-cms`

Before meaningful work, use the Personal Context Vault MCP server to load the
current project and read, at minimum:

- `PROJECT.md`
- `CURRENT-STATE.md`
- `LATEST-HANDOFF.md`
- `DECISIONS.md`
- relevant records under `decisions/`
- `PHASE-1-ARCHITECTURE.md` while it remains the governing RFC

Use the canonical `vault` CLI where it is available. Run
`vault context bundle --current --no-personal` before substantial work.

## Session Close

The phrase `I am done for now` is the session-close trigger. Follow
`~/AI-Vault/_system/protocols/Session-Close-Protocol.md`, update
`CURRENT-STATE.md` and `LATEST-HANDOFF.md`, and use the canonical `vault`
CLI or Personal Context Vault MCP workflow where available.

Create a dated record under `decisions/` and update `DECISIONS.md` whenever a
durable architectural choice is accepted, superseded, rejected, or deprecated.

## Safety and Change Control

- Do not commit or push unless the user explicitly requests it.
- Never store secrets, credentials, tokens, private keys, or sensitive content
  in the vault.
- Keep application code, build configuration, Functions, schemas, types, and UI
  assets in the frontend repository.
- Keep the sibling content repository content-only. It may contain content,
  configuration, media, and generated validation artifacts, but no executable
  application logic, API handlers, build system, or UI code.
- Do not blur the application/content boundary for convenience.

## Mandatory UI/UX Skill

For any work involving user interfaces, user experience, frontend pages,
visual components, accessibility, responsive behavior, navigation, forms,
tables, dashboards, charts, typography, colors, spacing, icons, motion, or
interaction design, load and follow:

`~/AI-Vault/_system/protocols/UI-UX-Skill-Policy.md`

Also load:

`~/AI-Vault/40-Resources/AI-Skills/UI-UX-Pro-Max/SKILL.md`

For an existing frontend audit, also load:

`~/AI-Vault/40-Resources/AI-Skills/UI-UX-Pro-Max/AUDIT-PROTOCOL.md`

Use the upstream search tooling at:

`~/AI-Vault/40-Resources/AI-Skills/UI-UX-Pro-Max/upstream`

Before substantial UI creation or redesign:

1. Detect the actual frontend stack.
2. Review existing brand and design-system constraints.
3. Generate and critically review a UI/UX Pro Max recommendation.
4. Read `design-system/astro-boilerplate-cms/MASTER.md` and use semantic tokens.
5. Verify WCAG AA, keyboard navigation, focus management, screen-reader
   semantics, 44px touch targets, responsive layouts, loading/error/empty
   states, and reduced-motion behavior.
6. Compare Flowbite and mature alternatives before changing the admin UI
   foundation.

Generated recommendations are inputs, not automatic decisions. Preserve the
accepted system unless a change is approved and recorded.

