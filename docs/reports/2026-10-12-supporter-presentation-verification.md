# Supporter benefits presentation — 2026-10-12

Historical snapshot. The user's next request replaces this benefit/offer presentation with [simple premium-theme placeholders](2026-10-12-premium-placeholders-verification.md).

The latest user request is interpreted as the existing Supporter tab. The supplied Flocus screenshot is a structural reference for readable benefit descriptions, not a source of HearthUI product claims or payment authorization.

## Implemented

- Supporter now opens a text presentation with a substantial heading, introduction, four benefit descriptions, an included-toolkit section, and one contribution/status panel.
- Desktop uses two columns of plain text; narrow screens use one column and internal scrolling. The existing Store glass appearance and fixed window geometry remain.
- Confirmed claims: implemented desktop badge; exclusive theme explicitly **Planned**; one-time $4.99 USDC contribution without a subscription; confirmed transaction receipt through Solana Explorer. The theme is not described as delivered.
- All 19 currently available registry widgets are explicitly included for everyone. Explore included widgets opens Widgets → All and focuses that tab.
- Supporter tab, Featured preview, and Featured viewer navigation all reach the same presentation. Entry routes reset the presentation scroll position.
- Existing supporters receive an active/receipt state instead of another payment. A valid transaction signature is required to expose receipt access. Unavailable items remain disabled Coming soon, including when connected to a wallet.
- The addon-only presentation helper uses existing catalog/session/bridge authorities. No dependencies, permission changes, escrow setup, transactions, or deployments were performed.

## Automated checks and review

- `npm test`: **PASS, 118/118**, zero failures/skips. Evidence: `docs/artifacts/store-gallery/supporter-tests.log`.
- `npm run build:demo`: **PASS**, unpacked build and ZIP contain 278 files and load `store-supporter.js` before `store-gallery.js`. Evidence: `supporter-build.log`.
- `git diff --check`; syntax checks for `addon/store-gallery.js` and `addon/store-supporter.js`: **PASS**. Root package has no lint/typecheck scripts; no TypeScript changed.
- Seven new helper tests cover unavailable checkout, both availability gates, connection action, owned/applied states, strict receipt eligibility, and invalid input. They were observed failing before implementation.
- Two public DOM route tests run the actual plain scripts and rendered button events. Independent review found Focus Bundle → Next bypassing the new presentation. The regression failed before the fix and passed afterward; it checks presentation, tab, hidden viewer, heading focus, disabled payment, and the included widget route.
- Independent scoped re-review: **approve**, no remaining concrete findings. Mechanical design detection ran once and returned an empty findings list (`supporter-design-detection.json`).
- Build emits its existing optional esbuild warning and ships JavaScript unminified. The build itself succeeds.

## Visual verification

- Surface tested: Store Supporter presentation, Featured entry and viewer navigation, included widget route, desktop and narrow layouts.
- URL/page or extension surface: `http://localhost:3435/newtab.html?qa=cached`, actual built demo with an isolated in-memory Chrome QA adapter. Installed extension host is not verified.
- Scenario executed: Featured → Focus Bundle → Next; inspect benefit/price/status copy; open Supporter directly; resize from 1440×900 to 390×844; keyboard-scroll to the contribution panel; Explore included widgets → verify 19 cards; return to Supporter; inspect console and network observations. Temporary viewport override reset afterward.
- Screenshot artifact: `docs/artifacts/store-gallery/supporter-presentation-1440.jpg`, `supporter-presentation-390.jpg`, `supporter-presentation-390-details.jpg`. The observed pre-fix route is recorded in `supporter-navigation-before-fix.jpg`.
- Browser recording artifact: not recorded.
- Console/network result: no captured console errors/warnings. The three changed presentation assets returned HTTP 200. No loading failures were present in the captured network events; the event buffer had truncated older history, so this is scoped asset evidence rather than an exhaustive network audit. Measurements: `supporter-evidence.json`.
- Criteria checked:
  - [PASS] Supporter contains four text benefit blocks and no generic SKU cards.
  - [PASS] Exclusive theme is labelled Planned; no unimplemented Flocus perks or revenue-share claim appears.
  - [PASS] One-time price and disabled Coming soon are visible; free widgets have a separate explanation.
  - [PASS] Benefits use two columns at 1440 and one at 390, with no horizontal overflow in the content region.
  - [PASS] Store remains 1171×855 at 1440×900 and 366×750 at 390×844. Switching to the longer Widgets catalog keeps the narrow dimensions unchanged.
  - [PASS] Featured/viewer navigation activates Supporter, hides the generic viewer, and focuses the presentation heading.
  - [PASS] Keyboard focus reaches the included-widget action and scrolls the contribution block into view.
  - [PASS] Explore opens all 19 widget cards at scroll position zero and focuses the Widgets tab.
  - [NOT VERIFIED] Existing Supporter receipt/active rendering in a real wallet session. Action eligibility is covered by automated tests; no fabricated paid entitlement was used in browser QA.
  - [NOT VERIFIED] Installed Chrome extension host and signed payments. Earlier browser URL-policy restriction remains; this HTTP demo is separate evidence.
- Verdict: **PARTIAL** overall host verification; **PASS** for the requested presentation and entry paths in the local demo.
- Known limitations and manual checks: in Chrome, open `chrome://extensions`, enable Developer mode, Load unpacked → `dist/hearthui-solana-demo`, then open the extension's new tab. Open Store → Supporter; repeat the desktop/narrow and Featured → Focus Bundle → Next checks. Confirm the theme says Planned and Coming soon is disabled. Real Supporter receipt verification requires a genuine confirmed entitlement; future payment activation still requires authorized escrow configuration and separate acceptance.

Final artifacts: `dist/hearthui-solana-demo.zip`, `dist/hearthui-solana-demo/`. Changes are uncommitted.
