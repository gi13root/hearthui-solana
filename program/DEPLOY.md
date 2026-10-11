# hearth_pass — build & deploy (devnet)

Status: source written, **never compiled**. Toolchain install needs owner approval.

## 1. Toolchain (macOS)
```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y      # official rustup
. "$HOME/.cargo/env"
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"                  # Anza (agave) Solana CLI
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cargo install --git https://github.com/coral-xyz/anchor avm --force           # Anchor version manager
avm install 0.31.1 && avm use 0.31.1
solana --version && anchor --version
```

## 2. Wallet + program id
```sh
cd program
solana config set --url https://api.devnet.solana.com
solana-keygen new -o ../keys/deployer.json          # keys/ is gitignored
solana airdrop 5 --keypair ../keys/deployer.json    # or https://faucet.solana.com
anchor keys sync                                    # writes real id into declare_id! + Anchor.toml
solana address -k ../keys/deployer.json             # -> put into ADMIN (non-localnet) in lib.rs
```
Then replace the placeholder `HPass111...` in `program/client/hearth-pass-client.js` (`config.programId`) with `anchor keys list` output.

## 3. Local tests (localnet, test mint/admin from public seeds)
```sh
npm install
anchor test -- --features localnet
```

## 4. Deploy
```sh
anchor build                         # no localnet feature => real USDC devnet mint
anchor deploy --provider.cluster devnet
```

## 5. Create the 3 themes (run as ADMIN)
Admin's USDC ATA = treasury; create it first:
`spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --owner <ADMIN> --fee-payer ../keys/deployer.json`
and the creator's ATA likewise (`--owner <CREATOR>`). Then in `anchor` TS (e.g. `scripts/create-themes.ts` via `anchor run`, or Playground client):
```ts
for (const [sku, price] of [["theme_aurora",1_990_000],["theme_dune",1_990_000],["icons_glass",2_990_000]])
  await program.methods.createTheme(themeId(sku), new BN(price), CREATOR).accounts({ admin: ADMIN }).rpc();
```

## Browser alternative — Solana Playground (no local install)
1. https://beta.solpg.io → new Anchor project, paste `programs/hearth_pass/src/lib.rs`.
2. Playground wallet → airdrop devnet SOL; set `ADMIN` to the playground wallet address.
3. Build → Deploy (Playground updates `declare_id!` automatically).
4. Use the Playground `client.ts` to run the createTheme loop above.

## Kill switch (plan M)
If not deployed by 2026-10-12 05:30 PT: `HearthPass.configure({ passEnabled: false })` →
`HearthPass.methodFor(sku)` returns `"usdc"` for every sku; addon/bridge must route through it.
