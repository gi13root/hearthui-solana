# Demo video shot list (≤ 3:00, devnet, English)

Prep: fresh Chrome profile; `npm run build:demo`; load `dist/hearthui-solana-demo/` unpacked;
Phantom on devnet with ≥ 0.1 SOL and ≥ 10 devnet USDC; DevTools console docked but hidden;
screen recorder 1080p, cursor highlight on. Each shot maps to an acceptance criterion (AC) of the plan.

| # | Time | Shot | Proves |
|---|---|---|---|
| 1 | 0:00–0:15 | Title card: "HearthUI × Solana — devnet demo". `chrome://extensions` showing "HearthUI (Solana demo)", ID `pbacff…gegpf`. | Prod build, fixed ID |
| 2 | 0:15–0:30 | Open new tab; open DevTools console briefly → no errors. | **AC1** loads, no console errors |
| 3 | 0:30–1:00 | Wallet widget (empty state "Connect wallet") → click → bridge tab → Phantom connect + sign message → back to new tab: widget shows address + real devnet SOL / USDC balance. Show small and large widget sizes. | **AC2** real devnet balance |
| 4 | 1:00–1:10 | SOL price widget, 24h change. | Price API |
| 5 | 1:10–1:50 | Theme store: `theme_aurora` locked (1.99 USDC). Buy → bridge → Phantom shows `buy_pass` tx → approve. Back on new tab: unlock appears **without reload**; on-screen stopwatch ≤ 10 s. Apply theme. | **AC3** pass unlock ≤ 10 s |
| 6 | 1:50–2:10 | Open the tx on Solana Explorer (devnet): 1.8905 USDC to creator, 0.0995 to treasury, pass PDA created. | 95/5 split, on-chain receipt |
| 7 | 2:10–2:35 | DevTools → Application → clear `hearth.solana.owned` from chrome.storage; quit and restart Chrome; open new tab → theme still owned (badge "verified on-chain"). | **AC4** persists from chain, not local storage |
| 8 | 2:35–2:50 | Terminal: in the HearthUI store repo `npm run build` → `grep -ri solana dist/ \| wc -l` → `0`. | **AC5** store build has zero Solana code |
| 9 | 2:50–3:00 | End card: repo URL, "Open source · MIT · built during Colosseum World's Fair". | — |

Fallbacks: if IPFPS is down, run with `HEARTH_IPFPS_BASE=mock` (wallet-only session) and say so on screen. If a devnet tx is slow, cut the wait but keep the stopwatch visible. Supporter (direct USDC, 4.99) can replace shot 5 only if the program is not deployed (Plan M kill switch).
