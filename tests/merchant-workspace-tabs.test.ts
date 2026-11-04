import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantWorkspaceTabs,isMerchantWorkspaceTab,merchantWorkspaceHash,parseMerchantWorkspaceHash} from '../modules/shops/workspace-tabs';

test('P2 merchant has six clearly separated operational workspaces',()=>{
 assert.deepEqual(merchantWorkspaceTabs.map(tab=>tab.id),
  ['orders','catalog','callcenter','delivery','finance','growth']);
 assert.equal(new Set(merchantWorkspaceTabs.map(tab=>tab.id)).size,6);
 assert.equal(new Set(merchantWorkspaceTabs.map(tab=>tab.label)).size,6);
 assert.ok(merchantWorkspaceTabs.every(tab=>tab.label.trim()&&tab.description.trim()));
 for(const tab of merchantWorkspaceTabs)assert.equal(isMerchantWorkspaceTab(tab.id),true);
 assert.equal(isMerchantWorkspaceTab('admin-global'),false);
});

test('P2 deep-link is limited to known merchant spaces without arbitrary URLs',()=>{
 for(const tab of merchantWorkspaceTabs){
  const hash=merchantWorkspaceHash(tab.id);
  assert.equal(parseMerchantWorkspaceHash(hash),tab.id);
  assert.equal(hash.includes('?'),false);
 }
 for(const invalid of ['#espace=admin-global','#espace=../../admin','#espace=orders%0A',
  '#espace=orders?token=secret','#not-a-workspace','#espace=']){
  assert.equal(parseMerchantWorkspaceHash(invalid),null);
 }
});
