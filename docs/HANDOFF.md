# HANDOFF

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
