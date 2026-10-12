// Creates the hackathon catalog themes on devnet. Run: npx node scripts/create-themes.cjs <creatorPubkey>
const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");
const idl = require("../target/idl/hearth_pass.json");

const themeId = (sku) => { const b = Buffer.alloc(32); Buffer.from(sku, "utf8").copy(b); return [...b]; };
const CATALOG = [["theme_aurora", 1_990_000], ["theme_dune", 1_990_000], ["icons_glass", 2_990_000]];

(async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, provider);
  const creator = new PublicKey(process.argv[2]);
  for (const [sku, price] of CATALOG) {
    const [theme] = PublicKey.findProgramAddressSync([Buffer.from("theme"), Buffer.from(themeId(sku))], program.programId);
    if (await provider.connection.getAccountInfo(theme)) { console.log(sku, "exists", theme.toBase58()); continue; }
    const sig = await program.methods.createTheme(themeId(sku), new anchor.BN(price), creator)
      .accounts({ admin: provider.wallet.publicKey, theme }).rpc();
    console.log(sku, theme.toBase58(), sig);
  }
})().catch((e) => { console.error(e); process.exit(1); });
