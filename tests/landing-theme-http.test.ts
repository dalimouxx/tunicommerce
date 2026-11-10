import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {stopTestServer} from './server-process';
import {storefrontThemeCodes,storefrontPalette} from '../modules/shops/storefront-themes';
const base='http://127.0.0.1:3197';
test('Public Tunicom landing and fourteen read-only theme previews work without a database connection',async()=>{
 let child:ChildProcess|undefined;
 try{
  child=spawn(process.execPath,['scripts/start.mjs'],{env:{...process.env,PORT:'3197',NODE_ENV:'production',APP_URL:'https://landing.example.test',DATABASE_URL:'postgresql://nobody@127.0.0.1:1/unreachable'},stdio:'ignore'});
  let ready=false;for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('Preview server exited');try{const response=await fetch(base+'/decouvrir');if(response.ok){ready=true;break;}}catch{}await pause(250);}assert.ok(ready);
  for(const path of ['/','/decouvrir']){
   const response=await fetch(base+path,{redirect:'manual'});assert.equal(response.status,200);
   const html=await response.text();assert.ok(html.includes('Ton business.'));assert.ok(html.includes('Tunicom'));
   assert.ok(html.includes('href="/inscription"'));assert.ok(html.includes('href="/connexion/boutique"'));
   assert.ok(html.includes('href="/themes/PULSE"'));assert.ok(html.includes('Démonstration')||html.includes('démonstration'));
   assert.equal(html.includes('TuniCommerce'),false);
  }
  for(const code of storefrontThemeCodes){
   const response=await fetch(base+'/themes/'+code);assert.equal(response.status,200,code);
   const html=await response.text();assert.ok(html.includes('data-theme="'+code+'"'));assert.ok(html.includes(storefrontPalette(code).name));
   assert.ok(html.includes('Aucun achat sur cette page.'));assert.equal(html.includes('<form'),false);
  }
  assert.equal((await fetch(base+'/themes/INVALID',{redirect:'manual'})).status,404);
 }finally{if(child&&child.exitCode===null){const exited=once(child,'exit');stopTestServer(child);await exited;}}
});
