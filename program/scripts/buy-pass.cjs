// Buys a theme pass on devnet with any keypair (for IPFPS claim testing without Phantom).
// Usage: ANCHOR_WALLET=/path/buyer.json node scripts/buy-pass.cjs <sku>
// Buyer needs devnet SOL (fees) and devnet USDC (faucet.circle.com). Prints the tx signature.
const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");
require("../client/hearth-pass-client.js");
const C = globalThis.HearthPassClient, H = globalThis.HearthPass;

(async () => {
  process.env.ANCHOR_PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  const provider = anchor.AnchorProvider.env();
  const sku = process.argv[2] || "theme_dune";
  const buyer = provider.wallet.publicKey.toBase58();
  const ix = await C.buildBuyPassIx({ buyer, sku, rpc: process.env.ANCHOR_PROVIDER_URL });
  const tx = new anchor.web3.Transaction().add(new anchor.web3.TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.keys.map((k) => ({ pubkey: new PublicKey(k.pubkey), isSigner: k.isSigner, isWritable: k.isWritable })),
    data: Buffer.from(ix.data),
  }));
  const sig = await provider.sendAndConfirm(tx);
  console.log(JSON.stringify({ buyer, sku, tx_signature: sig, receipt: (await H.derivePassPda(buyer, sku))[0] }));
})().catch((e) => { console.error(e.message || e); process.exit(1); });
