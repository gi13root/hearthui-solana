# Hearth Store — implementation and verification

**Later UI update:** the user removed the Creator gets 95% line, requested a fixed window matching Wallpaper Gallery, and added Widgets with nested categories. Current UI evidence and the 109-test suite are in [Widgets verification](2026-10-12-widgets-catalog-verification.md); the checks below retain the original implementation's history.

Checked 2026-10-12 PT on `hearthui-solana`, branch `main`, base `58491849bde6f877e405f4095816d52a190ccd79`. Changes are uncommitted. The supplied specification remains the product reference; the user's autonomous two-hour work window overrides its older schedule and approval workflow.

**Overall status: PARTIAL.** The local gallery implementation and HTTP demo checks pass. Actual extension-host checks and signed purchase acceptance remain unverified. No transaction, deployment, commit, push, secret change, or proprietary-core source edit occurred.

## What changed

- Seven-category glass gallery with six Featured cards; preview viewer, keyboard navigation, nested Escape, focus restoration, prices, Included/Soon/Owned/Applied states and wallet footer.
- Demo catalog from Hearth Originals; existing free content stays free. Midnight, Mono and Orbit are addon-owned procedural styles. Focus Bundle expands verified ownership to Aurora, Glass and Orbit.
- Thirty-second trials change DOM classes only, restore the layer they created, preserve unrelated changes, and support manual/automatic rollback. Persistent application reports success only after storage succeeds.
- Live ownership/error updates, safe Explorer links, cache-preserving RPC failures, wallet-switch isolation, stale-refresh protection, and malformed entitlement rejection.
- Widget See all entry and blank-desktop context menu use existing host APIs. Existing widget menus remain intact.
- Seventeen full WebP previews (1280×800) and seventeen thumbnails (480×300), captured from the local demo and packaged assets. Source JPEGs are in `docs/artifacts/store-gallery/`.
- Minimal existing catalog/session/client/bridge allowlist extensions and a read-only catalog provisioning check. Coupling and API semantics are recorded in `DEFERRED.md`.

## Automated verification

Fresh final checks:

| Command | Result |
| --- | --- |
| `npm test` | PASS, 99 tests, zero failed/skipped; baseline was 58 tests |
| `npm run build:demo` | PASS, unpacked build and ZIP, 238 files |
| `git diff --check` | PASS |
| `node --check` across addon and QA/provisioning scripts | PASS, 12 JavaScript files |
| `node program/scripts/create-themes.cjs CGvJ5c7uhiQjngSRzt5ce5fAtG5wwTinY5N4YeSAet49 --check` | PASS, read-only metadata check; three ready accounts, four missing |
| lint / typecheck | UNAVAILABLE: root package defines neither command; no TypeScript changed |

New tests were observed failing before implementation, including ownership, bundle gating, failed persistence, stale session refresh, preview restoration, Retry replacement loads, replaced widget openers, and provisioning metadata/endpoint validation. The independent reviewer requested the opener fix, then approved its scoped re-review. No unresolved code-review finding remains.

Final test/build output is saved as `docs/artifacts/store-gallery/test-output.txt` and `build-output.txt`.

Build limitation: the existing base builder reports absent esbuild and ships unminified JavaScript. Provisioning's existing Anchor dependencies emit Node's `punycode` deprecation warning. Neither warning failed its command. No dependency was added.

## Visual verification

- Surface tested: actual demo new-tab build, store widget, blank-desktop menu, gallery, viewer, trial banner and error/retry states.
- URL/page or extension surface: `http://localhost:3435/newtab.html` using the actual `dist/hearthui-solana-demo` files and an isolated QA-only in-memory Chrome adapter. This is **not** an installed-extension result.
- Scenario executed: open from See all and desktop menu; fetch verified public devnet receipts; browse categories/viewer; apply an owned theme; trial and manual/30-second rollback; two Escapes; replace opener during ownership refresh; disconnected sign-in routing; RPC outage with cached Aurora then successful Retry; loading skeletons; widths 1440/1024/700/390; reduced motion.
- Screenshot artifact: `docs/artifacts/store-gallery/featured-1440.jpg`, `featured-1024.jpg`, `featured-700.jpg`, `featured-390.jpg`, `desktop-context-menu.jpg`, `widget-focus-restored.jpg`, `themes-included.jpg`, `aurora-viewer.jpg`, `aurora-try-on.jpg`, `aurora-reverted.jpg`, `aurora-auto-reverted.jpg`, `aurora-applied.jpg`, `rpc-error-cached-owned.jpg`, `rpc-retry-recovered.jpg`, `wallet-disconnected.jpg`, `catalog-loading.jpg`, `unlock-feedback.jpg`, `reduced-motion.jpg`.
- Browser recording artifact: not recorded; screenshot and measured-state artifacts are retained.
- Console/network result: no console error/warning in the successful final scenario; no HTTP 4xx/5xx responses. Navigation canceled seven pending requests with `ERR_ABORTED`/type Other. The deliberate offline scenario rejects RPC by fixture design; cached ownership remains visible.
- Criteria checked:
  - [PASS] HTTP widget and desktop entries open the modal, nested Escape works, and focus returns to a replaced See all button.
  - [PASS] Seven tabs, six Featured cards, 3/2/1 columns at 1440/1024/700; 390 is also one column. No horizontal document overflow. Tab strip scrolls horizontally on narrow screens. Measurements: `responsive-evidence.json`.
  - [PASS] Images, names, Hearth Originals attribution, prices, Owned, Applied, Soon and Included states. All six free theme/pack entries remain Included.
  - [PASS] Public buyer `CxFm2rFCZfDE5XgWQUPgeyns4ZJ9zj3HkSLVGD4kHZ8L` shows Aurora/Dune/Glass owned after live chain refresh. No signer is available in the fixture.
  - [PASS] Aurora trial sets the theme class and hides the window. Revert and expiry restore classes/layer and reopen the viewer. The complete in-memory storage write log and applied-preference value are identical before and after both trials.
  - [PASS] Ownership refresh updates cards/toast without reload. Owned-mark animation is `hsg-unlock`, `0.3s`, using transform/opacity; under reduced motion it is `none`, `0s`.
  - [PASS] Receipt navigation requests the real Aurora PDA URL: `https://explorer.solana.com/address/36k4cP5iSGs1CPsEm8m4g3zzMKeBe6zXwgkuePgQQydk?cluster=devnet`. The QA adapter records the requested URL rather than opening a real extension tab.
  - [PASS] Footer has the 95/5 tooltip, connected indicator, and disconnected Connect wallet requests the existing sign-in bridge route.
  - [PASS] Six busy skeletons appear during delayed ownership reads. RPC error preserves cached Aurora; Retry clears the banner and restores three verified owned items.
  - [NOT VERIFIED] Actual installed extension lifecycle/CSP and signed Dune purchase. The browser tool rejected `chrome-extension://` navigation by URL policy; no workaround was attempted.
  - [NOT VERIFIED] Empty-category screenshot: the shipped catalog has entries in every category. Defensive empty rendering and pure filtering are present, but a fabricated empty live catalog was not treated as product evidence.
- Verdict: **PARTIAL** (HTTP scenarios PASS; extension and signed transaction criteria remain NOT VERIFIED).
- Known limitations and manual checks: follow the remaining prerequisite sequence below, load the unpacked build normally in Chrome, open its new-tab surface, repeat See all/right-click/Escape/trial/viewport checks, then buy an unowned item through the updated bridge and check its receipt. Expected success is Owned/receipt without reload; denial/cancellation must leave the item unowned.

## Spec acceptance reconciliation

| Spec §7 | Status | Evidence / boundary |
| --- | --- | --- |
| 1. Widget/menu/Escape/focus | Verified in HTTP; extension not verified | screenshots + replacement opener regression |
| 2. Tabs/Featured/responsive columns | Verified in HTTP | responsive-evidence.json and four screenshots |
| 3. Card content/states | Verified in HTTP | Featured/Themes/Applied screenshots |
| 4. Existing Aurora ownership from chain | Verified in HTTP with real public buyer | live RPC refresh, no localStorage grant |
| 5. 30-second trial/Revert/no storage writes | Verified in HTTP | before/after write-log comparison and screenshots |
| 6. Dune signed purchase/unlock/receipt | Not verified; UI update and URL verified separately | no signed purchase performed |
| 7. Creator tooltip/wallet states | Verified in HTTP | connected/disconnected screenshots |
| 8. Console | Verified in HTTP success path | no errors/warnings; deliberate outage is separate |
| 9. Reduced motion | Verified in HTTP | computed animation/transition values and screenshot |

## Current external prerequisites

Observed facts (HIGH confidence, live devnet checked 2026-10-12): Aurora, Dune and Glass accounts match program, creator, price, discriminator and 500 treasury basis points. Midnight/Mono/Orbit/Focus accounts are absent. Full account check: `docs/artifacts/store-gallery/devnet-catalog-check.json`. RPC inspection follows the official [getMultipleAccounts documentation](https://solana.com/docs/rpc/http/getmultipleaccounts).

Therefore only the three verified passes are available. The four new passes and Supporter are Soon. The current owned counter is N/3, not an invented N/7. The readiness gate supports an explicit verified catalog update once provisioning and bridge compatibility are complete.

Next sequence: create the missing devnet accounts with the prepared script when transaction execution is explicitly authorized; deliver the bridge catalog compatibility update to the hosted bridge under deployment authorization; then add verified SKUs to `READY_PASS_SKUS`, rebuild, and run the signed purchase/extension-host acceptance checks. Escrow remains outside this implementation. An older successful IPFPS owned response still takes precedence over chain fallback; merging newly added passes is documented as deferred.

## Reproduction commands

```sh
cd /Volumes/minix/elias/Documents/hearthui-solana
npm test
npm run build:demo
node tests/fixtures/store-gallery-demo-server.mjs
```

Open `http://localhost:3435/newtab.html?qa=cached`, choose Store widget → See all. `?qa=disconnected`, `?qa=offline`, and `?qa=slow` reproduce wallet/error/loading states. In the offline fixture, Alt+Shift+R restores network access before pressing Retry. All fixture writes are in-memory and discarded on navigation. The production ZIP excludes test fixtures.

Artifacts: `dist/hearthui-solana-demo/` and `dist/hearthui-solana-demo.zip`. Work stays in the current checkout; the core build comes from read-only git archive of `fix/search-api-1.3.1` (`2c460b2`).
