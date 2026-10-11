# Colosseum submission checklist — Crypto World's Fair, Solana track

Deadline **2026-10-12 23:59 PT**. Internal: **freeze 15:30 PT**, **submit by 22:00 PT**.
Fields below are inferred from the hackathon brief; confirm against the live form (owner).

## Form fields (inferred)

| Field | Value / source | Status |
|---|---|---|
| Project name | HearthUI × Solana | draft |
| One-line description | Creator-owned theme economy on the most-seen screen: wallet sign-in, USDC, on-chain theme passes in a Chrome new tab. | draft |
| Track | Solana | owner confirm |
| Team members / leader | [OWNER NAME], [handles] | owner |
| Team leader country of residence | must not be an excluded country (rules §3b) | **owner confirm** |
| GitHub repo (public) | [REPO URL] | make public before submit |
| Pitch video (2–3 min, English) | YouTube/Loom unlisted link — script: docs/pitch-script.md | todo |
| Demo video (≤ 3 min, English) | link — shot list: docs/demo-script.md | todo |
| Live demo / install link | GitHub Release with `hearthui-solana-demo.zip` | todo |
| Program ID (devnet) | from A3 (`hearth_pass`) | pending A3 |
| Prior work disclosure | README.md → "Prior work disclosure" | done (review) |
| Business model | docs/business-plan.md (5% take rate) | done (fill placeholders) |
| Traction | [INSTALLS], [WAU], [RATING], store URL | owner |
| Tech stack | Chrome MV3, Anchor/Rust, SPL USDC, Phantom, public RPC | done |
| Contact email | owner | owner |

## Judging criteria → evidence

Functionality → demo AC1–AC5 · Impact/TAM → business plan · Novelty → trustless theme passes on a new tab · UX using blockchain → bridge + ≤10 s unlock · Open source → MIT, public repo · Business plan → docs/business-plan.md.

## Timeline (PT)

| When | What | Who |
|---|---|---|
| 10-11 15:30 | Kickoff (T+0) | all |
| 10-12 05:30 (T+14) | Kill switch: program on devnet, else Plan M | A3 / owner |
| 10-12 12:00 | Feature complete; `npm test` green; `npm run build:demo` OK | A1–A3 |
| **10-12 15:30 (T+24)** | **Code freeze**; tag `v0.1.0-hackathon`; GitHub Release with zip | A4 |
| 10-12 15:30–18:30 | Record demo (shot list), record pitch | owner |
| 10-12 18:30–20:30 | Edit videos, upload, captions | owner |
| 10-12 20:30–22:00 | Fill form, make repo public, final review of links in incognito | owner + A4 |
| **10-12 22:00** | **Submit** (≈2 h buffer) | owner |
| 10-12 23:59 | Hard deadline | — |

## Pre-submit checks

- [ ] `npm test` green; `npm run build:demo` prints ext id `pbacffgkgjlkbnafpmakmmppcikgegpf`
- [ ] Zip loads unpacked on a clean Chrome profile, no console errors
- [ ] No secrets in repo: `git log -p | grep -i "BEGIN PRIVATE\|secret"` empty; `keys/` not tracked
- [ ] Release zip contains no admin/dev code (build checks this)
- [ ] All [PLACEHOLDERS] in README/pitch/business plan replaced or removed
- [ ] Video links open logged-out
- [ ] Repo public; LICENSE present; base-code licensing question resolved (see HANDOFF)
