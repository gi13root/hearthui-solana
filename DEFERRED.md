# Store gallery integration — 2026-10-12

The supplied gallery brief requires four additional pass SKUs. Existing purchase paths rejected these SKUs. Minimal compatibility changes extend only the existing catalog allowlists in addon/config.js, addon/solana-session.js, program/client/hearth-pass-client.js and bridge/bridge-core.js; message shape, origin checks, program instructions and permissions remain unchanged.

The bridge allowlist extension is unavoidable coupling: without it, clicking a new SKU returns `unknown_sku`. The hosted bridge must receive this compatibility update before those new purchases work there. No production deployment is authorized or performed. Local integration is testable independently.

Devnet account creation and real-wallet purchase verification are external-state actions described by the attached brief, not separately specified by the user's request. Prepare and verify scripts/accounts read-only; do not move assets or publish without explicit transaction authorization. UI must label unavailable entries honestly. Escrow/Supporter remains Soon.

`HearthStore.apply(sku, slot)` now returns `Promise<boolean>` and reports success after durable preference storage; existing widget callers remain compatible, gallery awaits the result. This closes failed-write/false-Applied behavior. `HearthPass.isOwned` / `HearthPassClient.isPassOwned` reject unavailable RPC or invalid receipt data instead of incorrectly returning false; session preserves verified cache and reports an error. These local API semantic changes have focused regression tests.

`program/scripts/create-themes.cjs` now includes all seven passes and a signing-key-free `--check` mode. Existing accounts must match the program, discriminator, creator, price and 95/5 fee split before reuse. The script was executed only with `--check`.

Deferred: merge a successful older IPFPS owned catalog with newly added chain passes. Current successful IPFPS response retains its existing precedence; wallet-only sessions use chain fallback. Actual extension host validation is blocked by browser URL policy. Local HTTP visual QA is separate evidence.

Later user-requested Widgets tab introduces addon-only `window.HearthStoreWidgets` (registry-backed catalog/filter helpers) and uses existing `WidgetRegistry.load`/`addWidget` for included widget actions. No bridge, program, permission, secret, or financial change is part of that UI follow-up. The original Creator gets 95% UI line and window sizing requirements are superseded by the user's later instructions.

The Supporter presentation follow-up adds addon-only `window.HearthSupporter.supporterOffer` to derive disabled/connection/payment/receipt labels from the existing catalog and ownership state. It does not grant ownership or enable an unavailable catalog entry. Supporter payments remain Soon while escrow is unset; its exclusive theme remains explicitly Planned. There are no bridge, program, permission, or transaction changes in this follow-up.

Historical intermediate state, superseded: Supporter was briefly replaced with premium-theme placeholders. The user's correction restored its benefits presentation and `HearthSupporter.supporterOffer` helper. Its original planned theme and unavailable escrow status remain truthful.

## Four date design stacks

Canonical parent products are `date_nothing_stack`, `date_liquid_stack`, `date_terminal_stack`, and `date_eink_stack`, each priced at 0.99 USDC and containing 24 static artwork samples. The 96 children have no purchase SKU. Local compatibility changes in configuration, session, Pass client, bridge, and provisioning inventory recognize only these four parents; old child IDs are rejected. Date account validation requires the correct owner, discriminator, layout, 990000-unit price, and 500-basis-point fee. Session refresh probes date stacks only when cached or explicitly ready, avoiding an unconditional per-design RPC fan-out. Message formats, permissions, and program instructions are unchanged.

The read-only account check found all four parent product accounts missing. Authorized account provisioning and hosted bridge deployment remain external prerequisites for real purchases. The local storefront has enabled parent Buy actions and routes the exact parent SKU, but no real transaction has been performed. Never substitute an existing unrelated product or fabricate ownership. No production secrets, CI/CD, or migrations were changed. Testing was stopped at the user's request; further verification is assigned to another agent.
