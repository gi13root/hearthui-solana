# Colosseum submission — draft texts (English)

Replace `[…]`. Field names are inferred; adapt to the live form.

**Project name:** HearthUI × Solana — Hearth Store

**One-liner:** A creator storefront inside the browser's new tab: themes and icon packs sold as on-chain passes, 95% paid to creators instantly in USDC.

**Track:** Solana

**Description:**
HearthUI is a Chrome new-tab launcher already live in the Chrome Web Store ([INSTALLS] installs). During the hackathon we built Hearth Store on Solana. Each paid item is a pass sold by our Anchor program `hearth_pass`: a single `buy_pass` instruction transfers USDC 95% to the creator and 5% to the treasury and creates a receipt PDA owned by the program. The extension verifies ownership directly from chain — no backend — so purchases follow the buyer's wallet to any device. A wallet bridge page connects Phantom to the extension (wallets can't inject into `chrome-extension://` pages). Through our platform partner IPFPS, the same Phantom sign-in also opens an account with points and a platform balance, so non-crypto users can unlock items too.

**How Solana is used:**
- Anchor program `hearth_pass` (devnet `4reMmBoV39ykPDMtm8XqrGxazE332kDx2KcJvAVriivA`): `create_theme`, `buy_pass` with on-chain 95/5 split and receipt PDA.
- USDC (SPL `transferChecked`), associated token accounts created idempotently.
- Phantom sign-in (SIWS-style message) and transaction signing via a static bridge page.
- Client-side ownership checks via `getAccountInfo` on receipt PDAs.
- IPFPS integration: Solana wallet login, USDC deposits to a platform escrow, digital-goods shop.

**Open source:** https://github.com/gi13root/hearthui-solana (MIT for this repository; the HearthUI base app is proprietary and is not published — the built demo is shared with judges on request).

**Prior work disclosure:**
HearthUI (the launcher) existed before the hackathon and is a separate, proprietary product. Built during the hackathon (Oct 11–12, 2026): the `hearth_pass` program and tests, the zero-dependency client, the wallet bridge, the Solana widgets (wallet, SOL price, store), the full Hearth Store window, the IPFPS integration, the demo build pipeline. No crypto code ships in the Chrome Web Store version.

**Business model:** 5% take rate on every sale; later: open creator publishing, widget marketplace for developers, NFT themes with royalties.

**Team:** [NAME] — founder & team leader (US). [Other members or "solo".]

**Links:** Pitch video: [URL] · Demo video: [URL] · Repo: https://github.com/gi13root/hearthui-solana · Demo build: available to judges on request (zip) · Bridge: https://gi13root.github.io/hearthui-solana/bridge/ · Chrome Web Store (HearthUI): [URL]

**Traction:** [INSTALLS] installs · [WAU] weekly active users · [RATING] rating · live since [DATE].
