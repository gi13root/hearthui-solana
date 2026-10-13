# Widgets catalog and fixed Store window — 2026-10-12

Latest user requests supersede the original Store brief's seven-tab layout, content-driven window size, and Creator gets 95% UI line. The existing financial rules are outside this UI change.

## Implemented

- Removed the Creator gets 95% line and tooltip from the Store footer and item viewer.
- Store window dimensions follow the measured Wallpaper Gallery main window. Dimensions depend on viewport, not category length or viewer state. The card grid owns scrolling.
- Added top-level Widgets tab with All, Clocks, Timer, Productivity, Time & Info, Utilities subcategories.
- Catalog includes 19 currently available types: 15 declared core factories and four registered addon factories. Availability comes from the existing registry; unavailable/unknown types are excluded.
- Added 19 full WebP previews and 19 thumbnails from real widget rendering in the local demo. Captures use default/empty configured states and representative QA-only note text; no personal widget data was copied.
- Widget cards/viewers expose Add widget through existing registry loading and the host addWidget function. These included items have no paid SKU. Duplicate loads coalesce; category changes/dismissal cancel pending additions. Load/add failures provide visible feedback.

| Filter | Cards |
| --- | --- |
| All | 19 |
| Clocks | 1 (Clock) |
| Timer | 3 (Countdown, Pomodoro, Timer) |
| Productivity | 6 |
| Time & Info | 5 |
| Utilities | 8 |

Clocks/Timer are focused views that overlap the three standard category groups. This classifies widget types; clock skin configuration remains part of the existing Clock widget.

## Checks

- `npm test`: PASS, 109/109, zero failures/skips.
- `npm run build:demo`: PASS; ZIP and unpacked build contain 277 files, including 38 new widget image assets.
- `git diff --check` and JavaScript syntax checks: PASS.
- No lint/typecheck script exists in the root package; no TypeScript or dependency change.
- Ten new widget catalog/action regressions were observed failing before their implementations/fixes. Independent review found an add-error suppression case after intentional close; the fix passed its regression and scoped re-review was approved.

## Visual verification

- Surface tested: Store window, Widgets tab and all subcategories, widget viewer, Add widget success/failure, responsive layout.
- URL/page or extension surface: `http://localhost:3435/newtab.html?qa=cached`, actual demo files with an isolated in-memory Chrome QA adapter. Installed extension remains outside the verified host.
- Scenario executed: compare Wallpaper Gallery/Store sizes at 1440/1024/700; switch all six widget filters; inspect all 19 loaded previews; open Timer viewer and navigate within its three-item filter; add Timer and verify desktop count changes from 0 to 1; inject an add failure and observe desktop snackbar; resize to 390 and verify scrollable category strips and no horizontal document overflow.
- Screenshot artifact: `docs/artifacts/store-gallery/widgets-all-1440.jpg`, `widgets-all-1024.jpg`, `widgets-all-700.jpg`, `widgets-all-390.jpg`, `widgets-all-bottom.jpg`, `widgets-clocks-1440.jpg`, `widgets-timer-1440.jpg`, `widgets-productivity-1440.jpg`, `widgets-time-1440.jpg`, `widgets-utilities-1440.jpg`, `widgets-timer-viewer.jpg`, `widgets-timer-added.jpg`, `widgets-add-error.jpg`, `wallpaper-size-reference.jpg`, `widget-preview-contact-sheet.png`.
- Browser recording artifact: not recorded.
- Console/network result: no related console errors/warnings in category, capture, or Add Timer success checks. All 19 image elements report complete/nonzero natural width. Deliberate add-error fixture is caught and produces “Couldn’t add Timer · Try again.” No remote wallet action occurs.
- Criteria checked:
  - [PASS] Creator gets 95% text is absent in gallery and viewer.
  - [PASS] Store equals measured Wallpaper main-window sizes at 1440×900 (1171×855), 1024×900 (805×665), 700×900 (676×806); at 390×844 it is 366×750. Short Clocks and long All retain identical window dimensions.
  - [PASS] Eight top tabs, including Widgets; requested subcategory labels and expected card groups are present.
  - [PASS] All 19 included widgets have preview and Add widget controls. No SKU/paid entitlement is created for them.
  - [PASS] Timer viewer labels Included with HearthUI; arrow navigation wraps to Countdown inside the Timer group.
  - [PASS] Add Timer closes the Store and creates exactly one visible Timer on the desktop.
  - [PASS] Rejected creation after successful loading and intentional gallery closure produces a visible desktop snackbar.
  - [PASS] Responsive grid has 3/2/1/1 columns at 1440/1024/700/390, with no horizontal document overflow. Narrow subcategories scroll instead of wrapping. Keyboard focus can reach the final card, scrolling the grid.
  - [NOT VERIFIED] Installed Chrome extension host. Earlier browser URL-policy restriction still applies; this HTTP check is not claimed as extension-host evidence.
- Verdict: **PARTIAL** overall host verification; **PASS** for all requested behaviors in the local demo.
- Known limitations and manual checks: load/reload `dist/hearthui-solana-demo` as an unpacked extension; open Store → Widgets; repeat filter/viewer/add checks in its actual new-tab page. The ZIP is ready, but the existing installation was not modified automatically.

Measured results: `widgets-category-evidence.json`, `widgets-layout-evidence.json`. Sources: `source-widget_*.jpg`. Final outputs: `dist/hearthui-solana-demo.zip`, `dist/hearthui-solana-demo/`.
