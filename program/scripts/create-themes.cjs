// Devnet catalog setup. --check is strictly read-only and requires no signing key.
// node program/scripts/create-themes.cjs <creatorPubkey> --check
const anchor = require('@coral-xyz/anchor');
const {PublicKey,Connection} = require('@solana/web3.js');
const idl = require('../target/idl/hearth_pass.json');
const {CATALOG,themeId,inspectThemeAccount,isAllowedRpc} = require('./store-catalog-accounts.cjs');
async function main(){
  const check=process.argv.includes('--check');
  const creator=new PublicKey(process.argv[2]), programId=new PublicKey(idl.address);
  const rpc=process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  if(!isAllowedRpc(rpc))throw Error('catalog provisioning is restricted to official devnet/localnet endpoints');
  const connection=new Connection(rpc,'confirmed');
  let program;
  if(!check){const provider=anchor.AnchorProvider.env();anchor.setProvider(provider);program=new anchor.Program(idl,provider);}
  const rows=[];
  for(const [sku,price] of CATALOG){
    const [theme]=PublicKey.findProgramAddressSync([Buffer.from('theme'),themeId(sku)],programId);
    const expected={programId:programId.toBase58(),creator:creator.toBase58(),creatorBytes:creator.toBuffer(),price};
    const status=inspectThemeAccount(await connection.getAccountInfo(theme),expected);
    if(status.status==='mismatch')throw Error(sku+': existing account mismatch ('+status.reason+')');
    if(status.status==='missing' && !check){
      const signature=await program.methods.createTheme([...themeId(sku)],new anchor.BN(price),creator).accounts({admin:program.provider.wallet.publicKey,theme}).rpc();
      const verified=inspectThemeAccount(await connection.getAccountInfo(theme),expected);
      if(verified.status!=='ready')throw Error(sku+': creation not verified');
      rows.push({sku,pda:theme.toBase58(),status:'ready',signature});
    }else rows.push({sku,pda:theme.toBase58(),...status});
  }
  console.log(JSON.stringify({network:rpc,readOnly:check,catalog:rows},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};
