# HANDOFF

ADDON_ORDER: store-date-concepts.js, config.js, solana-session.js, solana-logic.js, store-catalog.js, store-widget-catalog.js, store-supporter.js, store.js, store-gallery.js, store-entry.js, widgets.js

Store gallery current state and acceptance evidence: [store-gallery report](reports/2026-10-12-store-gallery-verification.md). New SKU account provisioning and hosted bridge compatibility remain external prerequisites; current availability is explicit in addon/config.js READY_PASS_SKUS.

Latest UI state: [Four date design stacks](reports/2026-10-12-date-stacks-verification.md). Eight Store tabs; 19 included widgets; Date Designs contains four purchasable style stacks, each with 24 static designs (8 Day, 8 Week, 8 Month). All shipped copy and preview artwork is English. Supporter's previous benefits presentation is restored. The last checks before the user's instruction to stop testing were 138/138 tests and a 479-file demo build. Local visual PASS; overall PARTIAL because installed-extension behavior and real purchases remain unverified. The four date-stack product accounts are missing, and the hosted bridge requires this compatibility update. No transactions or deployment were performed. Testing is stopped; independent verification is handed to another agent.

## QUESTIONS FOR OWNER

1. **Base ref = store release?** A4 builds the demo from `fix/search-api-1.3.1` (manifest 1.3.1, commit 2c460b2 "chore(release): prepare 1.3.1", pushed to origin). Is 1.3.1 what is live in the Web Store, or is it 1.3.0/1.2.x? Override with `HEARTH_BASE_REF=<ref> npm run build:demo`.
2. **Licensing of the base code.** HearthUI is proprietary (its AGENTS.md/CLAUDE.md). This repo is MIT and public, but the Release zip contains the built HearthUI. OK to distribute the built base in a public GitHub Release? If not: publish only the add-on and ask judges to install via build script / a private link.
3. **Traction numbers** for pitch/business plan: [INSTALLS], [WAU], [RATING], releases count, store URL.
4. **Team leader residence / eligibility** (rules §3b) and team member list for the form.
5. **Price API**: demo grants `https://api.coingecko.com/*` (matches `addon/config.js` PRICE_URL). Keep CoinGecko?
6. **Public repo URL** and video hosting (YouTube unlisted vs Loom).


## From A3 (on-chain) → A1, A2
- `program/client/hearth-pass-client.js` (window.HearthPass) is self-contained: base58, SHA-256 (WebCrypto), ed25519 off-curve check, PDA, ATA derivation. A1 may reuse it instead of a separate solana-lite; no `bridge/vendor/solana-lite.js` existed when written.
- A1 (bridge): `await HearthPass.buildBuyPassInstruction({buyer, sku, creator, treasury})` → `{programId, keys:[{pubkey,isSigner,isWritable}], data}`; wrap into a Transaction (+ recent blockhash) and sign with Phantom. creator/treasury = wallets from theme PDA (creator) and ADMIN.
- A1/A2: always pick payment via `HearthPass.methodFor(sku)`; kill switch `HearthPass.configure({passEnabled:false})`.
- A2/A1: ownership check `await HearthPass.isOwned(rpcUrlOrFn, wallet, sku)`.
- After deploy: programId placeholder `HPass111...` must be replaced (client config + lib.rs + Anchor.toml).
- A4: root `npm test` = `node --test tests/` fails on Node 25 ("Cannot find module tests"); suggest `node --test tests/*.test.js`.

## A4 — Build, product & submission

- **Base ref choice:** `fix/search-api-1.3.1` @ 2c460b2. Reasoning: highest manifest version among committed refs (1.3.1 "Stable"), changelog entry 1.3.1 is a release-prep commit pushed to `origin`; tags stop at v1.2.0; `release/v3-v1.0` is 1.2.1 and older. Working tree of v3 (`feat/sync`, dirty) is never used — `git archive` of the commit only.
- **Build:** `npm run build:demo` → `dist/hearthui-solana-demo/` + `dist/hearthui-solana-demo.zip`. Runs base `scripts/make-dist.js` (production; fails if authoring code leaks). esbuild is not installed in the archive, so base JS ships unminified (functionally identical, larger).
- **Script order:** `addon/config.js`, `addon/solana-session.js`, then `program/client/hearth-pass-client.js` (if present), then remaining `addon/*.js` alphabetically. A1/A2: to override, add one line here: `ADDON_ORDER: config.js, solana-session.js, wallet-widget.js, ...` (listed files first, rest alphabetical). `HEARTH_DEMO_MOCK=1` also injects `mock/*.js` first.
- **Manifest patch:** `key` from scripts/manifest-key.pub.txt (verified → `pbacffgkgjlkbnafpmakmmppcikgegpf`), `externally_connectable.matches` = heartui.ipfps.org + localhost:3434, host_permissions += devnet RPC, heartui.ipfps.org, CoinGecko; name "HearthUI (Solana demo)".
- **Note for all:** `npm test` changed to `node --test tests/*.test.js` (Node 25 treats `tests/` as a file and fails).

## From A2 (widgets & store UI) → A4, A1

**A4 — injection into newtab.html**
- `ADDON_ORDER: config.js, solana-session.js, solana-logic.js, store.js, widgets.js` (same as alphabetical; listed for safety).
- All addon `<script>` tags must come AFTER base `widget-registry.js`, `newtab-core.js` (defines `const WIDGET_CATALOG`) and `newtab-widgets.js` (defines `applyWidgetSizeState`), and BEFORE `newtab-main.js` / whatever triggers the first layout render (so `WidgetRegistry.loadForLayout` finds `solanaWallet`, `solPrice`, `hearthStore`, `focusBoard` already registered). Do not use `defer`/`async`.
- Add `<link rel="stylesheet" href="addon/addon.css">` after `newtab.css`.
- Host permissions needed (already in your patch): `https://api.devnet.solana.com/*`, `https://api.coingecko.com/*`, `https://heartui.ipfps.org/*`. Explorer links open `https://explorer.solana.com` in a new tab (no permission needed).
- No manifest additions beyond yours. Uses `chrome.storage.local` (base manifest already has `storage`).
- Widget types added to the catalog: `solanaWallet`, `solPrice` (utilities), `hearthStore` (utilities), `focusBoard` (productivity). Sizes injected into `WidgetRegistry.WIDGET_SIZES` at load.

**A1 — API expected on `window.HearthSolana` (all optional, with fallbacks)**
- `openBridge(action, sku?)` — required for UX; fallback opens `config.bridgeUrl()` in a new tab.
- `getSession()` → `{address, jwt}|null` (sync or Promise); fallback reads `chrome.storage.local['hearth.solana.session']`.
- `ipfpsFetch(path, init)` — optional; lets `HEARTH_IPFPS_BASE=mock` route to the mock. Fallback: `fetch(base + path)`.
- Store reads `hearth.solana.owned` as `string[]` or `{skus: string[]}` and reacts to `chrome.storage.onChanged` (instant, no reload). A1 writes it (IPFPS owned → PDA check). A2 writes only `hearth.solana.applied` = `{theme, icons}`.
- Focus: A2 wraps `window.HSLTasksBus.addSession` (pomodoro calls it on completed focus ≥30s); posts `{minutes, ended_at, season, source}` to `/api/hearth/focus` with `Authorization: Bearer <jwt>` when ≥60s and jwt present.

## From A1 (bridge & auth) — 2026-10-11

**To A3 (program client)** — bridge and session expect `window.HearthPassClient` (IIFE) with:
- `buildBuyPassIx({ buyer: base58, sku, rpc }) -> Promise<Ix | Ix[]>` where `Ix = { programId: base58, keys: [{ pubkey: base58, isSigner, isWritable }], data: Uint8Array }`. Include any create-ATA ixs you need. The bridge compiles a legacy message (`bridge/vendor/solana-lite.js`) and sends via Phantom `request({method:'signAndSendTransaction', params:{message: base58}})`.
- `isPassOwned(address: base58, sku) -> Promise<boolean>` (PDA `["pass", buyer, theme_id]` exists && owner == program id). Used by `addon/solana-session.js` refreshOwned fallback.
- Feel free to reuse `bridge/vendor/solana-lite.js` (`window.SolanaLite`: base58, sha256, isOnCurve, findProgramAddress, findPassPda, themeId, getAssociatedTokenAddress, transferCheckedIx, compileLegacyMessage, rpc, confirmSignature). PDA derivation is checked against the solana.com docs vector.
- Bridge loads `bridge/vendor/hearth-pass-client.js`, falling back to `../program/client/hearth-pass-client.js` (local preview).

**To A2 (addon UI)** — load order in newtab: (`bridge/vendor/solana-lite.js` optional) → `program/client/hearth-pass-client.js` → `addon/solana-session.js`. API: `window.HearthSolana.{getSession, getOwned, isOwned(sku), openBridge(action, sku), refreshOwned, signOut, onChange(fn)}`. Session messages only arrive while a HearthUI page is open (listener lives in the page, not a service worker). Set `window.HEARTH_IPFPS_BASE` before the script if not default.
- `hearth.solana.owned` is written as `{ skus: string[], items: [{sku, source, tx_signature?, ...}] }` (your `{skus}` reader works). `ipfpsFetch(path, init)` is provided.
- **Fix needed in your focus post:** IPFPS ignores `Authorization: Bearer` (API doc §4.2) — send `Init-Data: <jwt>`. Body per brief F7 is `{ session_id: uuid, minutes: int 5..90, started_at: ISO }` (not `ended_at/season/source`); sessions <5 min get `400 invalid_minutes`. The mock enforces this.

**To A4 (build/docs)**
- Please add `"bridge": "node bridge/serve.mjs"` to package.json scripts (preview at http://localhost:3434/bridge/#action=signin; IPFPS mock auto-on for localhost, `?ipfps=live` to disable).
- Deploy: copy `bridge/` to `https://heartui.ipfps.org/bridge/` and `program/client/hearth-pass-client.js` into `bridge/vendor/`. `mock/` is NOT needed in production.
- Escrow: `HEARTH_ESCROW_DEVNET` is still null in `bridge/bridge-core.js` `CONFIG.escrow`; `pay` shows `escrow_not_configured` until set (testing: `#action=pay&sku=supporter&escrow=<base58>`).

**Open questions for IPFPS (friend)**: leaderboard wrapper key (mock assumes `{ season, entries:[{rank,nickname,score}] }`); `chain` value for verify (`solana` vs `solana-devnet`; bridge sends `solana`).
