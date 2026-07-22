# Quality gates

The release gate combines deterministic automation with human accessibility review.

## Automated checks

Run these from the frontend repository:

```text
npm run check
npm test
npm run build
npm run test:e2e -- --workers=4
npm run test:visual
npm run test:lighthouse
npm audit --omit=dev
```

The functional browser matrix covers desktop Chromium, Firefox, WebKit (Safari engine), and a 375-pixel touch viewport. Axe checks run inside the public and admin workflows. Pixel comparisons cover desktop and mobile Chromium with platform-neutral reference images and a maximum one-percent differing-pixel ratio.

Lighthouse runs the production output three times. Every run must meet these minimum category scores:

| Category       | Minimum |
| -------------- | ------: |
| Performance    |    0.95 |
| Accessibility  |    1.00 |
| Best practices |    0.95 |
| SEO            |    1.00 |

The checked-in GitHub Actions workflow installs all browser engines and runs the complete gate on pull requests and `main`. Update visual references only after reviewing the rendered change: `npm run test:visual:update`.

## Manual review

Automated checks do not prove WCAG conformance. Complete [the manual accessibility checklist](MANUAL-ACCESSIBILITY-CHECKLIST.md) before a template release and record browser, assistive technology, date, tester, result, and issue link.

## Current environment note

The macOS Firefox engine installed by Playwright 1.61 can freeze in this local environment when starting a test. Chromium visual/functional checks and the complete unit, build, and Lighthouse gates pass locally. The CI workflow remains the authoritative clean Linux run for Firefox and WebKit; a release is not complete if either CI project fails.
