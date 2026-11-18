import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('the merchant dashboard sidebar always offers logout, not only on the settings page',()=>{
 const app=read('components/merchant/shell.tsx');
 const start=app.indexOf("<aside className={'sidebar");
 assert.ok(start>=0,'sidebar not found');
 const sidebar=app.slice(start,app.indexOf('</aside>'));
 assert.ok(read('components/commerce-app.tsx').includes('<Sidebar '),'dashboard no longer renders the sidebar');
 assert.ok(sidebar.includes('<PortalLogout portal="MERCHANT"'),'logout missing from the dashboard sidebar');
});
test('the shop workspace header offers logout',()=>{
 assert.ok(read('app/mes-boutiques/[shopId]/merchant-shop-workspace.tsx').includes('<PortalLogout portal="MERCHANT"'));
});
