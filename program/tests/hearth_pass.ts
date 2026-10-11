// Run with: anchor test -- --features localnet   (see program/DEPLOY.md)
// Localnet build uses a test mint and admin derived from PUBLIC seeds [7;32] / [8;32].
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import { HearthPass } from "../target/types/hearth_pass";

const themeId = (sku: string) => {
  const b = Buffer.alloc(32);
  Buffer.from(sku, "utf8").copy(b);
  return [...b];
};

describe("hearth_pass", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HearthPass as Program<HearthPass>;
  const conn = provider.connection;

  const mintKp = Keypair.fromSeed(new Uint8Array(32).fill(7));
  const admin = Keypair.fromSeed(new Uint8Array(32).fill(8));
  const creator = Keypair.generate();
  const buyer = Keypair.generate();
  const PRICE = 1_990_000; // 1.99 USDC
  const SKU = "theme_aurora";
  let mint: PublicKey;
  let buyerAta: PublicKey, creatorAta: PublicKey, treasuryAta: PublicKey;

  const pda = (seeds: (Buffer | Uint8Array)[]) =>
    PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const themePda = pda([Buffer.from("theme"), Buffer.from(themeId(SKU))]);
  const passPda = (w: PublicKey) =>
    pda([Buffer.from("pass"), w.toBuffer(), Buffer.from(themeId(SKU))]);

  const airdrop = async (to: PublicKey) => {
    const sig = await conn.requestAirdrop(to, 2 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
  };

  const buyAccounts = (who: Keypair, m: PublicKey, bAta: PublicKey) => ({
    buyer: who.publicKey, theme: themePda, pass: passPda(who.publicKey), mint: m,
    buyerAta: bAta, creatorAta, treasuryAta,
  });

  before(async () => {
    await Promise.all([admin, buyer].map((k) => airdrop(k.publicKey)));
    mint = await createMint(conn, admin, admin.publicKey, null, 6, mintKp);
    buyerAta = (await getOrCreateAssociatedTokenAccount(conn, admin, mint, buyer.publicKey)).address;
    creatorAta = (await getOrCreateAssociatedTokenAccount(conn, admin, mint, creator.publicKey)).address;
    treasuryAta = (await getOrCreateAssociatedTokenAccount(conn, admin, mint, admin.publicKey)).address;
    await mintTo(conn, admin, mint, buyerAta, admin, 10_000_000);
  });

  it("creates a theme", async () => {
    await program.methods
      .createTheme(themeId(SKU), new anchor.BN(PRICE), creator.publicKey)
      .accounts({ admin: admin.publicKey, theme: themePda } as any)
      .signers([admin])
      .rpc();
    const t = await program.account.theme.fetch(themePda);
    expect(t.creator.toBase58()).to.eq(creator.publicKey.toBase58());
    expect(t.price.toNumber()).to.eq(PRICE);
    expect(t.treasuryBps).to.eq(500);
  });

  it("rejects create_theme from non-admin", async () => {
    const rando = Keypair.generate();
    await airdrop(rando.publicKey);
    try {
      await program.methods
        .createTheme(themeId("theme_dune"), new anchor.BN(PRICE), creator.publicKey)
        .accounts({ admin: rando.publicKey } as any)
        .signers([rando])
        .rpc();
      expect.fail("should fail");
    } catch (e: any) {
      expect(String(e)).to.match(/Unauthorized|ConstraintAddress/);
    }
  });

  it("buy_pass splits 95/5 and writes the receipt", async () => {
    await program.methods
      .buyPass(themeId(SKU))
      .accounts(buyAccounts(buyer, mint, buyerAta) as any)
      .signers([buyer])
      .rpc();
    const fee = Math.floor((PRICE * 500) / 10_000);
    expect(Number((await getAccount(conn, creatorAta)).amount)).to.eq(PRICE - fee);
    expect(Number((await getAccount(conn, treasuryAta)).amount)).to.eq(fee);
    expect(Number((await getAccount(conn, buyerAta)).amount)).to.eq(10_000_000 - PRICE);
    const r = await program.account.passReceipt.fetch(passPda(buyer.publicKey));
    expect(r.buyer.toBase58()).to.eq(buyer.publicKey.toBase58());
    expect(r.price.toNumber()).to.eq(PRICE);
    expect(r.paidAt.toNumber()).to.be.greaterThan(0);
  });

  it("double buy fails", async () => {
    try {
      await program.methods
        .buyPass(themeId(SKU))
        .accounts(buyAccounts(buyer, mint, buyerAta) as any)
        .signers([buyer])
        .rpc();
      expect.fail("should fail");
    } catch (e: any) {
      expect(String(e)).to.match(/already in use|0x0/);
    }
  });

  it("wrong mint fails", async () => {
    const other = Keypair.generate();
    await airdrop(other.publicKey);
    const fake = await createMint(conn, other, other.publicKey, null, 6);
    const fakeAta = (await getOrCreateAssociatedTokenAccount(conn, other, fake, other.publicKey)).address;
    await mintTo(conn, other, fake, fakeAta, other, 10_000_000);
    try {
      await program.methods
        .buyPass(themeId(SKU))
        .accounts(buyAccounts(other, fake, fakeAta) as any)
        .signers([other])
        .rpc();
      expect.fail("should fail");
    } catch (e: any) {
      expect(String(e)).to.match(/WrongMint|ConstraintAddress|ConstraintTokenMint/);
    }
  });
});
