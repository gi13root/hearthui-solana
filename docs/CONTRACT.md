# hearthui-solana — shared contract (all agents read first)

Hackathon: Colosseum Crypto World's Fair, Solana track. Deadline 2026-10-12 23:59 PT. Plan **S**.
All repo content in **English**. Public repo (open source). No secrets ever committed (`keys/` is gitignored).

## Repo layout & ownership

| Path | Owner | What |
|---|---|---|
| `bridge/` | A1 | Static web page (no bundler, no CDN) hosted at `https://heartui.ipfps.org/bridge/`. Phantom connect, sign-in, pay, buy_pass. |
| `addon/` | A2 (UI) + A1 (`addon/solana-session.js`) | Plain scripts injected into HearthUI new tab: session, wallet widget, price widget, theme store, gates. |
| `program/` | A3 | Anchor program `hearth_pass` + tests + `program/client/hearth-pass-client.js` (IIFE, no bundler). |
| `mock/` | A1 | `ipfps-mock.js`: in-browser mock of IPFPS endpoints, same contract as brief. |
| `scripts/` | A4 | `build-demo.mjs`: HearthUI base + addon → `dist/hearthui-solana-demo/` + zip. |
| `docs/`, `README.md` | A4 | README, prior-work disclosure, pitch + demo scripts, business plan. |

Never edit another owner's files; if you need a change there, write it in `docs/HANDOFF.md` under the owner's name.

## Constants

- Extension ID (fixed via manifest `key`): `pbacffgkgjlkbnafpmakmmppcikgegpf`; public key: `scripts/manifest-key.pub.txt`.
- Network: devnet. RPC `https://api.devnet.solana.com`. USDC devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (decimals 6).
- IPFPS base: `https://heartui.ipfps.org` (flag `HEARTH_IPFPS_BASE`; value `mock` → `mock/ipfps-mock.js`).
- Escrow (direct USDC, sku `supporter`): placeholder `HEARTH_ESCROW_DEVNET` in `addon/config.js` until friend confirms.

## Catalog (hackathon only)

| sku | price USDC | method |
|---|---|---|
| `supporter` | 4.99 | `usdc` (transfer to escrow ATA) |
| `theme_aurora` | 1.99 | `pass` (program, 95% creator / 5% treasury) |
| `theme_dune` | 1.99 | `pass` |
| `icons_glass` | 2.99 | `pass` |

## Program `hearth_pass`

- `create_theme(theme_id: [u8;32], price: u64, creator: Pubkey)` → PDA `["theme", theme_id]`: `{creator, price, treasury_bps: 500, bump}`.
- `buy_pass(theme_id)` → USDC transfer buyer→creator ATA (95%) and →treasury ATA (5%); init PDA `["pass", buyer, theme_id]`: `buyer: Pubkey | theme_id: [u8;32] | price: u64 | paid_at: i64 | bump: u8` (after 8-byte discriminator). Fails if pass exists.
- `theme_id` = sku UTF-8, zero-padded to 32 bytes.
- Ownership check (client, no server): `getAccountInfo(PDA("pass", wallet, theme_id))` exists && owner == program id.

## Messaging: bridge ⇄ extension

Bridge → extension via `chrome.runtime.sendMessage(EXT_ID, msg)` (manifest `externally_connectable.matches`: `https://heartui.ipfps.org/*`, `http://localhost:3434/*`).
Extension opens bridge in a tab: `https://heartui.ipfps.org/bridge/#action=<signin|pay|buy>&sku=<sku>`.

```
{ v:1, type:"session", address, jwt|null, network:"devnet" }
{ v:1, type:"purchase", sku, method:"usdc"|"pass", tx_signature, status:"confirmed" }
{ v:1, type:"error", action, code, message }
```
Extension replies `{ok:true}`. Extension stores session in `chrome.storage.local` key `hearth.solana.session`; owned list in `hearth.solana.owned`.

## IPFPS endpoints used (see friend brief)

`GET /api/auth/nonce`, `POST /api/auth/web3/verify`, `GET /api/user/me`, `GET /api/hearth/owned`, `POST /api/hearth/claim`, `POST /api/hearth/focus`, `GET /api/leaderboard?season=focus_2026_10`.
Ownership source of truth order: IPFPS `owned` → on-chain PDA check → never local-only.

## Rules for every agent

- MV3 CSP: no eval, no remote code, no ES modules in extension pages; plain `<script src>`; shared `window`.
- Widgets follow HearthUI `aw` rules: small/medium/large layouts, loading/empty/error states, glanceable.
- Tests: `node --test` in `tests/`. Write the test first for logic (parsers, PDA derivation, message validation).
- Self-review before finishing: re-read your diff, run tests, list what you did NOT verify.
- Commit only your own paths: `git add <your paths>` then `git diff --cached --stat` check before `git commit`.
- Report back: files changed, tests run + result, open questions, handoffs.
