# Store preview preparation

Checked 2026-10-12 against demo build based on HEAD `58491849bde6f877e405f4095816d52a190ccd79`.
The core and its existing assets are read-only. Sources below are observed local files (HIGH confidence); no internet artwork or invented creators. All store entries credit the supplied demo author, Hearth Originals.

## Catalog contract

`addon/store-catalog.js` exports browser `HearthStoreCatalog` and CommonJS. Tab IDs: `featured`, `themes`, `icons`, `clocks`, `live`, `bundles`, `supporter`.
`expandOwned` returns unique known SKU strings, expands only catalog-declared Focus Bundle contents, accepts strings/entitlements/`{skus,items}`, and ignores malformed or explicitly unconfirmed records. Input must come from existing session ownership APIs, never from preview state.
`cardState` returns a state string; `applied` input may be a SKU or `{theme,icons,clock}`. Applied requires ownership. `ownedCount` counts available SKU entries, currently Aurora, Dune, and Glass: three possible owned items. `HearthSolanaConfig.READY_PASS_SKUS` controls readiness at catalog initialization; new passes stay Soon until verified. `createCatalog(readySkus)` provides isolated readiness fixtures for tests. Included and Soon entries do not inflate it. `formatPrice` returns `$X.XX USDC`, `Free`, or `Soon`.

Preview filenames are `addon/store-previews/<id>.webp` (1280×800) and `<id>-thumb.webp` (480×300). Root agent owns actual capture/conversion and visual acceptance verdict; this report supplies capture targets only.

## Desktop / procedural capture targets

Capture from actual demo desktop at 1440×900. Apply classes to `<html>` for a temporary capture, then restore them; do not persist purchases or settings. Ensure `#hs-theme-layer` exists using the existing store controller.

| Item IDs | Temporary class / target |
| --- | --- |
| theme_aurora | `hs-theme-aurora`; capture desktop |
| theme_dune | `hs-theme-dune`; capture desktop |
| theme_midnight | `hs-theme-midnight`; capture desktop; new CSS in store-content.css |
| icons_glass | `hs-icons-glass`; dock screenshot; existing Glass style |
| icons_mono | `hs-icons-mono`; `#dock .app-icon` / `.appgrid-wrap .appgrid-app-icon`; new CSS |
| clock_orbit | `hs-clock-orbit`; `.clk-widget`, `.clk-face`; new CSS |
| retro_flip | existing flip clock if available, clearly label as upcoming |
| bundle_focus | combine `hs-theme-aurora hs-icons-glass hs-clock-orbit`; capture desktop |
| supporter | `hs-supporter` existing badge; clearly label as upcoming/exclusive theme pending |

Actual Mono image/fallback selectors: `.dock-favicon`, `.dock-fallback`, `.ag-favicon`, `.ag-fallback` within their app tiles. The filter lives on the image/fallback rather than the tile, preserving dock magnification and hover transforms.
Actual Orbit variables: `--clk-acc`, `--fc-digit-color`, `--clk-digit-opacity`, `--clk-g1`, `--clk-g2`, `--clk-glass-stroke-digit-color`, `--clk-glass-stroke-digit-w`. The core uses `.clk-svg-time` with presentation fill, `.fc-digit-num`, `.nw-time`, and `.clk-time-row`; Orbit scopes overrides to the active html class without modifying core storage. SVG material rims retain their stroke-only fill.

## Free theme and live sources

All paths below are relative to `dist/hearthui-solana-demo/` (or copied demo root). Capture these locally, with no network dependence.

| ID | Original source | Existing thumb |
| --- | --- | --- |
| half_dome | assets/wallpapers/themes/half-dome.avif | assets/wallpapers/themes/thumbs/half-dome.webp |
| astronaut | assets/wallpapers/themes/astronaut.avif | assets/wallpapers/themes/thumbs/astronaut.webp |
| green | assets/wallpapers/themes/green.avif | assets/wallpapers/themes/thumbs/green.webp |
| yosemite_depth | assets/wallpapers/depth-yosemite/yosemite-base.avif | capture still with play indicator |
| deep_sea | procedural gradient from #031b2f via #07566b to #00111c | clearly label as concept / Soon |

## Included collage candidates

Existing `wallpaper-catalog.js` categorizes 9 landscapes, 12 flora-fauna, and 7 space-abstract entries. Use a local three-panel collage at 16:10, not paid or newly attributed content.

| ID | Three existing thumbnails |
| --- | --- |
| landscapes_pack | assets/wallpapers/thumbs/landscapes/desert-sunset.webp; assets/wallpapers/thumbs/landscapes/coast-waves.webp; assets/wallpapers/thumbs/landscapes/rice-terraces-aerial.webp |
| flora_fauna_pack | assets/wallpapers/thumbs/flora-fauna/bougainvillea-wall.webp; assets/wallpapers/thumbs/flora-fauna/chameleon.webp; assets/wallpapers/thumbs/flora-fauna/dew-lotus-leaf.webp |
| space_abstract_pack | assets/wallpapers/thumbs/space-abstract/jupiter.webp; assets/wallpapers/thumbs/space-abstract/solar-prominence.webp; assets/wallpapers/thumbs/space-abstract/pearl-fluid-wave.webp |

## Verification boundary

Catalog focused tests cover filtering, bundle expansion, malformed entitlement rejection, applied ownership, count, and price formatting. CSS uses observed actual core selectors. Visual verification is pending root's actual extension run and screenshots; existence of selectors is not a PASS verdict. New pass-SKU purchase availability is gated by root's verified `READY_PASS_SKUS` configuration (currently Aurora/Dune/Glass only).
