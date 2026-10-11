# HearthUI × Solana — a creator-owned theme economy on the most-seen screen

HearthUI is a minimalist, Android-style **new-tab launcher for Chrome** (widgets, dock,
live wallpapers, themes) that is already live in the Chrome Web Store. This repository is
the **Colosseum Crypto World's Fair (Solana track)** add-on: it lets people sign in with a
Solana wallet, pay in USDC, and buy **theme passes** from creators through our own on-chain
program `hearth_pass` — with ownership verified straight from the chain, no server needed.

![Demo GIF placeholder](docs/media/demo.gif)
<!-- TODO(owner): record docs/media/demo.gif from the demo video -->

## Install the demo (devnet)

1. Download `hearthui-solana-demo.zip` from **[Releases](../../releases)** and unzip it.
2. Open `chrome://extensions`, switch on **Developer mode**, click **Load unpacked**, pick the unzipped folder.
3. Open a new tab. Extension ID is fixed: `pbacffgkgjlkbnafpmakmmppcikgegpf`.
4. Have **Phantom** set to **devnet** with some devnet SOL and devnet USDC
   (mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`).

The demo is a separate unpacked build. The Chrome Web Store version of HearthUI contains **no** Solana code.

### Build it yourself

```bash
npm test
npm run build:demo   # needs a local checkout of the HearthUI base repo (see docs/HANDOFF.md)
```

`scripts/build-demo.mjs` exports a committed HearthUI ref with `git archive`, runs its own
production build (admin/dev code stripped), injects the add-on scripts, patches the manifest
(fixed `key`, `externally_connectable`, devnet/IPFPS/price host permissions) and zips it.

## Architecture

```
 ┌──────────────────────── Chrome (MV3 extension, chrome-extension://pbacff…) ─────────────────┐
 │  HearthUI new tab  ── addon/: config · solana-session · wallet widget · price widget ·      │
 │                        theme store + gates · program/client/hearth-pass-client.js (IIFE)    │
 │        │  reads balances / pass PDAs                    ▲ chrome.runtime.sendMessage         │
 └────────┼────────────────────────────────────────────────┼────────────────────────────────────┘
          │ JSON-RPC (public)                               │ {type:"session"|"purchase"|"error"}
          ▼                                                 │
 ┌──────────────────┐   signAndSendTransaction   ┌─────────────────────────────────────────┐
 │  Solana devnet   │◄───────────────────────────│ Bridge page  heartui.ipfps.org/bridge/  │
 │  hearth_pass     │                            │ Phantom connect · signMessage · pay/buy │
 │  USDC (SPL)      │                            └───────────────┬─────────────────────────┘
 └──────────────────┘                                            │ nonce → sign → verify (JWT)
                                                                 ▼
                                                   IPFPS API (sign-in, owned, claim, focus)
```

Phantom does not inject into `chrome-extension://` pages, so every wallet action happens on
the bridge page, which reports back to the extension over `externally_connectable`.

## How Solana is used

| Feature | What happens on-chain |
|---|---|
| **Sign in with Solana** | Bridge asks Phantom to `signMessage` an IPFPS nonce; the signature is verified server-side and a session is sent to the new tab. Wallet-only session as fallback. |
| **USDC pay** (`supporter`, 4.99 USDC) | Plain SPL-USDC transfer to an escrow token account; the tx signature is the receipt. |
| **`hearth_pass` program** (Anchor) | `create_theme(theme_id, price, creator)` stores a theme PDA; `buy_pass(theme_id)` splits USDC **95% to the creator / 5% to the treasury** atomically and creates a pass PDA `["pass", buyer, theme_id]`. |
| **On-chain receipts** | The new tab checks ownership with one `getAccountInfo` on the pass PDA via public RPC. Unforgeable, serverless, survives reinstalls and devices. |

Catalog for the hackathon: `supporter` (USDC), `theme_aurora`, `theme_dune` (1.99 USDC), `icons_glass` (2.99 USDC) — see [docs/CONTRACT.md](docs/CONTRACT.md).

## Prior work disclosure

**Existed before the hackathon (not submitted for judging):** HearthUI itself — the Chrome
MV3 new-tab launcher, its widgets, dock, wallpapers, theme system and production build
pipeline — developed by the team leader and published on the Chrome Web Store before
2026-10-11. Its source lives in a separate, privately licensed repository; this repo only
pulls a committed release ref at build time.

The IPFPS platform (wallet sign-in API) is a pre-existing third-party service operated by a
friend of the team; we only consume its API.

**Built during the hackathon (2026-10-11 → 2026-10-12), all in this repository:**
the `hearth_pass` Anchor program and its client, the Phantom bridge page, the extension
add-on (Solana session, wallet and price widgets, theme store and ownership gates), the IPFPS
mock, the demo build pipeline, tests, and all docs/videos. Full history: `git log`.

## Roadmap

1. Mainnet deploy of `hearth_pass` after an external review; USDC on mainnet.
2. Creator self-serve: upload a theme, set a price, get paid — no server, no Stripe account.
3. Solana Actions / Blinks: "buy this theme" shareable on X.
4. Proof-of-focus seasons: Pomodoro minutes → on-chain season badges and leaderboard.
5. Ship the wallet as an opt-in module in the store build once Chrome review and UX are proven.

## Docs

[Pitch script](docs/pitch-script.md) · [Demo script](docs/demo-script.md) ·
[Business plan](docs/business-plan.md) · [Submission checklist](docs/submission-checklist.md) ·
[Contract](docs/CONTRACT.md)

## License

MIT for this repository — see [LICENSE](LICENSE). The HearthUI base extension is licensed separately.
