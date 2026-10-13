const {createHash} = require('node:crypto');
const CATALOG = [['theme_aurora',1990000],['theme_dune',1990000],['icons_glass',2990000],['theme_midnight',1990000],['icons_mono',2990000],['clock_orbit',990000],['bundle_focus',4990000]];
CATALOG.push(...require('../../addon/store-date-concepts.js').items.map(item=>[item.sku,Math.round(item.price*1000000)]));
const themeId = sku => {const b=Buffer.alloc(32);Buffer.from(sku,'utf8').copy(b);return b;};
function isAllowedRpc(value){
  try {const url=new URL(value);return (url.protocol==='https:' && url.hostname==='api.devnet.solana.com') || (['http:','https:'].includes(url.protocol) && ['localhost','127.0.0.1'].includes(url.hostname));}catch{return false;}
}
function inspectThemeAccount(account,expected){
  if(!account)return {status:'missing'};
  const data=Buffer.from(account.data), owner=String(account.owner.toBase58 ? account.owner.toBase58() : account.owner);
  const discriminator=createHash('sha256').update('account:Theme').digest().subarray(0,8);
  if(owner!==expected.programId || data.length!==51 || !data.subarray(0,8).equals(discriminator))return {status:'mismatch',reason:'owner or account layout'};
  let creatorBytes=expected.creatorBytes;
  if(!creatorBytes){require('../client/hearth-pass-client.js');creatorBytes=globalThis.HearthPass.base58Decode(expected.creator);}
  if(!data.subarray(8,40).equals(Buffer.from(creatorBytes)) || data.readBigUInt64LE(40)!==BigInt(expected.price) || data.readUInt16LE(48)!==500)return {status:'mismatch',reason:'creator, price or fee split'};
  return {status:'ready'};
}
module.exports={CATALOG,themeId,inspectThemeAccount,isAllowedRpc};
