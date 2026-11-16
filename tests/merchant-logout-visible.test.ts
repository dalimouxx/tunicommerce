import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('the merchant dashboard sidebar always offers logout, not only on the settings page',()=>{
 const app=read('components/commerce-app.tsx');
 const sidebar=app.slice(app.indexOf("<aside className={'sidebar"),app.indexOf('</aside>'));
 assert.ok(sidebar.includes('<PortalLogout portal="MERCHANT"'),'logout missing from the dashboard sidebar');
});
test('the shop workspace header offers logout',()=>{
 assert.ok(read('app/mes-boutiques/[shopId]/merchant-shop-workspace.tsx').includes('<PortalLogout portal="MERCHANT"'));
});
