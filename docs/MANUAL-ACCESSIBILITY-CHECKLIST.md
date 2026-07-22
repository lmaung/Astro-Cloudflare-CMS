# Manual accessibility assessment

Automated axe and Lighthouse checks are necessary but do not prove WCAG conformance. Complete this checklist on the reference site and protected admin before each template release. Record the browser, assistive technology, date, tester, route, outcome, and issue link.

## Keyboard

- Start at the address bar and operate every workflow using Tab, Shift+Tab, Enter, Space, arrow keys, and Escape only.
- Confirm the skip link is first, visible on focus, and moves focus to the main content.
- Confirm focus order follows the visual and semantic reading order.
- Confirm every focused control has a visible indicator that is not obscured.
- Create and edit a page; add, reorder, hide, duplicate, and remove a block.
- Reorder navigation and reusable content with explicit keyboard controls.
- Open and cancel permanent deletion, then confirm focus remains logical.
- Confirm no keyboard trap and no workflow depends on hover, drag, or pointer precision.

## Screen reader

Test VoiceOver with Safari on macOS and NVDA with Firefox on Windows when available.

- Navigate by landmarks, headings, links, form controls, lists, and regions.
- Confirm one meaningful level-one heading and a logical heading hierarchy.
- Confirm page, block, navigation, reusable-library, media, redirect, and footer fields have useful accessible names and descriptions.
- Confirm required, invalid, disabled, expanded, selected, current, loading, saved, conflict, and error states are announced.
- Confirm array controls announce the item and action, not only “Add” or “Remove.”
- Confirm decorative images are ignored and meaningful images announce accurate alternative text.
- Confirm external links and repeated links make sense out of context.

## Zoom, reflow, contrast, and motion

- Verify 200% browser zoom at 1280 CSS pixels without clipped controls or horizontal two-dimensional scrolling.
- Verify 320 CSS-pixel reflow and 400% text zoom for core workflows.
- Verify text, controls, focus indicators, errors, disabled states, and image overlays meet WCAG AA contrast.
- Verify touch targets are at least 44 by 44 CSS pixels or have sufficient spacing.
- Enable reduced motion and confirm no essential information depends on animation.
- Enable forced colors/high contrast and confirm controls, focus, selection, and errors remain identifiable.

## Content and SEO semantics

- Confirm page title, language, canonical URL, description, robots directive, and social image alternative text match the current page.
- Confirm structured data contains only visible, accurate organization and page information.
- Confirm archived and missing pages are not indexed or listed in the sitemap.
- Confirm redirects do not loop and preserve query parameters only when configured.

## Required record

```text
Date:
Build/commit:
Tester:
Browser and version:
Assistive technology and version:
Routes/workflows:
Passed:
Issues:
Retest result:
```
