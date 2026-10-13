# Hearth Store gallery implementation plan

**Goal:** Implement the supplied store-gallery spec in the Solana addon, preserving the read-only HearthUI core.
**Spec:** ../specs/hearth-store-gallery.md (living acceptance reference; this plan records implementation decisions and verification).
**Architecture:** Plain MV3-compatible scripts. A catalog supplies immutable items and pure ownership/filter/price helpers; a gallery owns modal/viewer/preview state. Existing session and Pass APIs remain the authority for purchases and ownership. CSS copies the gallery's visual tokens and uses viewport breakpoints required by the brief.
**Tech stack:** Existing JavaScript, CSS, node:test; no new runtime dependencies.
**Execution:** User explicitly requests autonomous parallel agents, no questions, two-hour work window (11:20–13:20 PT). No commits, pushes, production deployment, secret changes, or core edits.

## Scope and boundaries
IN: seven tabs, six Featured cards, responsive glass window, viewer, reversible 30-second trials, supported purchase/apply/receipt flows, cache/error handling, preview assets, focused tests, demo build and visual QA.
OUT: escrow implementation, proprietary-core modifications, mainnet purchases, public deployment, invented authors, monetizing included content.
Devnet catalog additions may require minimal existing session/client allowlist updates because current APIs reject new SKUs. Record any public-API or program configuration change in DEFERRED.md. Never silently advertise an unavailable SKU as purchasable.

## Shared catalog contract
`window.HearthStoreCatalog` and CommonJS exports: `tabs` array of `{id,label,icon}`; `items` array of `{id,sku?,name,kind,tab,price,status,author,description,preview,thumb,includes?,featured?}`. `status` = `available` / `included` / `soon`; kinds = theme/icons/clock/live/wallpaper-pack/bundle/badge.
Helpers: `filterItems(tabId)`, `expandOwned(owned)`, `cardState(item,owned,applied)`, `ownedCount(owned)` returns `{owned,total}`, `formatPrice(item)`.
Owned input accepts string arrays, entitlement arrays, or `{skus,items}`. Bundle grants apply to included SKUs only after verified bundle ownership; malformed values do not grant access.

## Review focus
- Rapid open/close and stale async ownership results must not reopen dismissed UI or erase current state.
- Trial replacement, expiry, ownership changes, and unrelated desktop edits must restore only trial-owned changes.
- Malformed storage and unavailable RPC must preserve last verified cache without fabricating ownership.
- Keyboard focus, nested Escape, and narrow viewports must remain usable.
- New SKUs must pass all existing purchase/session/client allowlists before enabled purchase UI.

## Tasks
- [x] G1: Gallery JS/CSS and failing-first focused tests; modal/viewer/trial/error/receipt/focus behavior implemented.
- [x] G2: Catalog, procedural styles, readiness gate, tests and preview-source documentation.
- [x] Orchestrator: Widget/menu, application slots/bundle grants, SKU compatibility tests and read-only provisioning check. Four accounts missing; chain writes not performed.
- [x] Orchestrator: Demo built; 17 preview pairs captured; HTTP success/narrow/viewer/trial/error/reduced-motion states verified with artifacts. Actual extension-host access blocked by browser policy.
- [x] Reviewer: Initial focus issue fixed, scoped re-review approved; reliability and persistence regressions pass.
- [x] Handoff: Criteria and external gaps reconciled in [verification report](../reports/2026-10-12-store-gallery-verification.md).

## Current state and decisions
Local implementation and UI follow-ups are complete. Overall acceptance remains PARTIAL because installed-extension behavior and real date-stack purchases are unverified. Last checks before the user's stop-testing instruction: 138/138 tests and a 479-file production demo build. [Current handoff](../reports/2026-10-12-date-stacks-verification.md) distinguishes local visual PASS from missing product accounts and hosted checkout deployment. Testing is stopped; independent verification belongs to the next agent.

- SG-001 (accepted): keep the supplied spec as intent reference, this plan as living execution state, and report as acceptance evidence. No duplicate planning system or core inventory.
- SG-002 (accepted): absent/unverified accounts remain Soon; promote only after account metadata and selected bridge compatibility are verified. This intentionally defers four purchase-ready positions rather than inventing chain readiness.
- SG-003 (accepted): existing purchase APIs require minimal SKU allowlist coupling; preserve their message formats and permissions, record semantic changes in DEFERRED.md.
- SG-004 (accepted): HTTP demo verification is distinct from installed-extension verification. Browser policy rejection is not a reason to claim host acceptance.

Next action: authorized devnet catalog provisioning and hosted bridge update, followed by real extension and signed purchase acceptance. No local blocker remains.

## User-requested UI follow-up

- [x] Remove Creator gets 95% from footer and viewer.
- [x] Fix window dimensions to match Wallpaper Gallery; confirm dimensions remain stable across short/long tabs and viewer.
- [x] Add Widgets with nested All/Clocks/Timer/Productivity/Time & Info/Utilities catalog using all 19 currently available registry types.
- [x] Capture/render 19 preview pairs and verify Add widget through existing host APIs, including cancellation/duplicate/failure cases.
- [x] Resume after explicit pause and complete final checks: 109 tests, production build, browser screenshots, scoped review approval.

SG-005 (accepted, supersedes original UI geometry/tab/footer intent): the user's later requests define the current Store presentation. Core source remains read-only; widget additions use its existing registry and addWidget API. [Current acceptance evidence](../reports/2026-10-12-widgets-catalog-verification.md).

## Supporter presentation follow-up

Goal: present Supporter as a readable overview of benefits and conditions, using the supplied screenshot as a structural reference. Users are HearthUI desktop users deciding whether to support the product. The existing Store visual language and fixed window remain the compatibility boundary.

IN: a substantial heading/introduction; four plain text benefit blocks; clear Planned label for the unimplemented exclusive theme; a separate free-toolkit explanation and route to Widgets; one-time $4.99 USDC contribution/status block; Supporter tab and Featured/viewer navigation reach the same presentation; safe loading/ownership/receipt state and responsive keyboard access.
OUT: copying Flocus subscription prices or features; inventing cloud sync/priority support/early access; new payment methods, escrow provisioning, real transactions, installed extension changes, or additional dependencies.

Acceptance criteria: Supporter has no single SKU card; desktop benefits form two columns and narrow view one column; the theme is explicitly planned; all current registry widgets remain included; unavailable payments have disabled Coming soon; existing supporters cannot be offered a second payment; validated receipts alone enable receipt access; every entry route displays the presentation; Store geometry stays unchanged; local browser checks capture screenshots and inspect errors.

SG-006 (accepted again by SG-008): separate Supporter benefit presentation from individual customization items. Reuse catalog, session, and bridge authorities; a small pure `HearthSupporter.supporterOffer` helper only derives presentation action state. The exclusive theme stays planned because no implementation exists. Use the existing script-order mechanism, not a second catalog/payment authority.

- [x] Confirm benefit/payment claims against the implementation with an independent audit.
- [x] Add failing-first action-state tests and implement presentation/helper/script order.
- [x] Fix and regression-test the alternate viewer navigation route found by review; observed red before fix, green afterward.
- [x] Complete final desktop/narrow visual evidence, automated checks, and scoped re-review approval. Local visual PASS; overall host PARTIAL. [Report](../reports/2026-10-12-supporter-presentation-verification.md).

## Premium placeholder simplification

SG-007 (superseded by SG-008): this intermediate implementation incorrectly interpreted the user's request as replacing Supporter with premium-theme placeholders. The user subsequently clarified that the supplied date concepts should appear as static Store products and requested restoration of Supporter. The following criteria and report are historical evidence only.

Visible criteria: three identifiable static slots; short future-purchase text; disabled availability controls; no premium price or benefit promises in this section; all entry routes/focus preserved; fixed window and 3/1-column desktop/narrow layout without horizontal overflow. Reuse current tokens and scripts; remove the unused offer helper and obsolete tests. Public DOM route regressions were observed failing before the change, then passing. Independent review approved; 111 current tests and the 277-file build pass. [Report](../reports/2026-10-12-premium-placeholders-verification.md).

## Confirmed date-stack scope

SG-008 (accepted; supersedes SG-007 and reinstates SG-006): the user explicitly selected four stacks, each selling one complete style with 24 designs. Styles are Nothing OS, Liquid Glass, CRT Terminal, and Color E-Ink. Each contains 8 Day, 8 Week, and 8 Month artwork samples. Samples have no SKU, price, widget factory, or individual checkout. Parent products cost 0.99 USDC each and expose enabled Buy actions with no Coming soon labels. All visible copy and artwork is English. Dates are fixed in the supplied artwork; these are static concept previews, not functional widgets.

The Date Designs category presents four stack cards; the viewer filters 24 samples to 8 by period and enlarges a sample while preserving its parent checkout. Native selector keys cannot trigger product navigation. Ownership totals count parent products once and exclude children. Existing working-widget actions and fixed Store dimensions are preserved.

Local purchase compatibility covers configuration, session recognition, bridge routing/labels, client validation, and provisioning inventory. A read-only check found all four new product accounts absent. The hosted bridge also needs the local update. No signing, account creation, payment, commit, push, or deployment was performed.

## Validation handoff
Before testing was stopped, the latest `npm test` passed 138 tests and `npm run build:demo` produced 479 files. Root package has no lint or typecheck scripts. Local visual evidence and limitations are recorded in the current report. Per the user's latest instruction, do not run further automated tests or visual QA in this task; the next agent owns independent verification.
