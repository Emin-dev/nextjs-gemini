# Verification

Use Node.js 24 and run:

```sh
npm ci
npm audit --audit-level=low
npm run build
npm run typecheck
npx --no-install playwright install --with-deps chromium
npm run test:smoke
```

Sharp 0.35.5 requires Node.js 20.9.0 or newer. The dependency repair was checked locally on Node.js 24.19.0.

## Browser smoke scope
The workflow builds and serves the app on loopback only, using fresh synthetic browser data at desktop and mobile viewport sizes. Tests check rendering, runtime/hydration errors and 404 behavior. They never follow outbound links or submit to external services. Remote task artwork is fulfilled from a test fixture before any image-provider request, so synthetic IDs stay local. This does not verify the live image provider or production deployment.

GitHub Actions uses a standard Ubuntu runner, a read-only repository token and pinned official actions. No credentials are retained by checkout; no secrets, cache, artifact uploads or deployment steps are used. Browser output is console-only.

## Lint remains unresolved
`npm run lint` is inherited from the original project and requires an ESLint setup that is not installed. It is not a passing check.

A strict isolated probe of `eslint-config-next@15.5.27` with `next/core-web-vitals` and `next/typescript` was performed without changing application source. It found 7 errors and 16 warnings in the existing Gemini code, including an icon `any` cast, unused bindings, hook dependency warnings and a stale CSS-package require in Tailwind configuration. These are not suppressed.

Do not add that dependency stack as-is: it currently introduces high-severity [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through the braces/fast-glob dependency chain, with no patched braces release listed. The compatible [ESLint 9 line is also end-of-life](https://eslint.org/version-support/); ESLint 10 is outside the Next.js 15 config peer range. No force/legacy-peer-deps installation or rule suppression is used.

Resume lint setup when a patched compatible stack is available, or as part of a separately tested framework/tooling migration. [Next.js 15 is Maintenance LTS](https://nextjs.org/support-policy). Until lint and applicable deployment/browser review gates are resolved, keep the security repair as a draft.
