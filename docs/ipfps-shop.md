# IPFPS shop rail (tenant `heartui`)

Second payment rail next to the on-chain `hearth_pass` program: platform account + internal currency (`WP`) + digital goods.
Contract: IPFPS integration guide §6.5 (player API) and §12.12 (S2S catalog). The S2S key is **never** in this repo or the extension; catalog changes are made by the operator from a terminal.

## Catalog (created 2026-10-12 19:25 PT, all active)

| product_id | code | title | price | rail in the demo |
|---|---|---|---|---|
| 10000000048 | `pts_theme_sunrise` | Sunrise | 300 WP | points (granted via S2S credit) |
| 10000000049 | `pts_clock_neon` | Neon Clock | 300 WP | points |
| 10000000050 | `usdc_theme_ocean` | Ocean | 2000 WP | USDC → escrow deposit → WP (1 USDC = 1000 WP) |
| 10000000051 | `usdc_icons_paper` | Paper Icons | 3000 WP | USDC → escrow deposit → WP |

Payloads (`content`, returned only to the owner of an `active` item):

- `hearthui.theme.v1` — `{kind:"theme", id, name, accent, background:{type:"gradient", angle, stops[]}}`
- `hearthui.clock.v1` — `{kind:"clock", id, name, digitColor, glow, weight}`
- `hearthui.icons.v1` — `{kind:"icons", id, name, tile, shadow, radius, filter}`

## Client flow (player JWT in `Init-Data`, origin `chrome-extension://pbacffgkgjlkbnafpmakmmppcikgegpf`)

1. Sign in: `GET /api/auth/nonce?address=` → Phantom `signMessage` → `POST /api/auth/web3/verify` (`chain` per operator: `solana` or `solana-devnet`) → JWT. Bridge already does this.
2. Balance: `GET /api/user/me` → `balances.WP`.
3. Showcase: `GET /api/shop/products` (no payload).
4. Buy: `POST /api/shop/buy {"product_id":N,"idempotency_key":"<fresh UUID>"}` → always `200 pending_payment`.
5. Poll `GET /api/shop/inventory` every ≥2 s until the item is `active` (grant) or `rejected` (insufficient funds — not an HTTP error).
6. Content: `GET /api/shop/inventory/{id}/content` → apply locally.
7. Errors: `400 bad_request` (non-UUID key), `404 not_found` (inactive SKU / foreign item), `503 shop_unavailable` (retry), `429 SLOW_DOWN`.

USDC deposit (when the operator adds a devnet token policy): read escrow/mint/rate from `GET /api/deposit/config` (public), link wallet `POST /api/user/wallets/link`, send `createAssociatedTokenAccountIdempotent` + `transferChecked` to the escrow, then `POST /api/deposit/verify {signature, chain}`. Until then the demo stops at the Phantom confirmation (Cancel) — no real funds.

## Leaderboard shape (live)

`GET /api/leaderboard?season=…` → `{top_players:[{id,rank,name,avatar,score,level}], my_rank_info, has_more}` — the addon parser must read `top_players`.
