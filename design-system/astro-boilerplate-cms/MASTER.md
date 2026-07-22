# Accepted Design System — Astro Boilerplate CMS Platform

Status: accepted for Phase 1; implementation details remain subject to UI audit.

## Review Note

The required UI/UX Pro Max search was run on 2026-07-21 for a Git-backed CMS
admin and small-business reference site. Its Inter recommendation, restrained
motion, visible focus, and semantic-token guidance were accepted. Its neon cyan,
magenta, near-black palette and single-CTA landing pattern were rejected as a
poor match for a professional content tool and a reusable reference website.

## Product Surfaces

- **Admin:** calm, dense-but-readable productivity UI; neutral surfaces;
  progressive disclosure; explicit status and validation.
- **Reference site:** token-driven and brandable. The example brand must not
  hard-code the platform's admin identity.

## Semantic Tokens

Token names are contractual; values may be themed. Initial light admin values:

| Token | Value | Use |
|---|---:|---|
| `--color-bg-canvas` | `#f8fafc` | application background |
| `--color-bg-surface` | `#ffffff` | cards, panels, forms |
| `--color-bg-subtle` | `#f1f5f9` | secondary regions |
| `--color-text-primary` | `#0f172a` | primary text |
| `--color-text-secondary` | `#475569` | supporting text |
| `--color-border-default` | `#cbd5e1` | controls and boundaries |
| `--color-action-primary` | `#1d4ed8` | primary action |
| `--color-action-primary-hover` | `#1e40af` | hover/pressed |
| `--color-focus-ring` | `#2563eb` | visible keyboard focus |
| `--color-success` | `#047857` | success status |
| `--color-warning` | `#a16207` | warning status |
| `--color-danger` | `#b91c1c` | destructive/error |

Use contrast-tested on-color tokens for filled controls. Do not place raw color
values in components.

## Typography and Space

- Inter or system sans for the admin; self-host fonts in production or use the
  system stack to avoid a blocking third-party request.
- Base text 16px, line-height at least 1.5; never below 12px.
- A 4px base spacing scale with semantic aliases for control, panel, and page
  gaps.
- Content measure around 65–75 characters; admin panels use fluid grids.

## Components and Interaction

- Prefer native semantic elements and accessible headless primitives.
- Every interactive target is at least 44×44 CSS pixels.
- Focus is always visible; dialogs trap and restore focus; notifications use
  appropriate live regions.
- Loading, success, validation, conflict, empty, and dependency-failure states
  are designed states—not incidental text.
- Reordering supports keyboard controls in addition to pointer/drag input.
- Destructive actions require clear confirmation and recovery guidance.
- Animation is optional, transform/opacity based, usually 150–250ms, and
  disabled or simplified under `prefers-reduced-motion`.

## Responsive Baseline

Verify at 320/375, 768, 1024, 1440, 1920, and representative 4K widths. Use
fluid containers with readable max-widths; never scale the entire UI to fill an
ultra-wide display. No workflow may depend on hover.

## Admin UI Foundation Direction

Use Tailwind CSS plus accessible headless primitives (Radix-based components
or equivalent) and a small project-owned component layer. Do not adopt Flowbite
Admin wholesale. Flowbite may be used selectively only after component-level
accessibility verification. React is limited to the admin application island;
the public renderer remains Astro-first.

