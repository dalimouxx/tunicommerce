import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {shopAccess} from '../modules/shops/navigation';

const shop={id:'shop-a',legacyWorkspaceId:'workspace-a',status:'PUBLISHED',active:true,role:'OWNER'};
test('only the owner of a linked personal workspace can access its commerce',()=>{
 assert.equal(shopAccess(shop,'workspace-a').manageOwnCommerce,true);
 assert.equal(shopAccess(shop,'workspace-b').manageOwnCommerce,false);
});
test('team members are never routed to personal commerce',()=>{
 assert.equal(shopAccess({...shop,role:'MANAGER'},'workspace-a').manageOwnCommerce,false);
 assert.equal(shopAccess({...shop,role:'VIEWER'},'workspace-a').mayOpenTeam,true);
});
test('no commercial access for unlinked or inactive shops',()=>{
 assert.equal(shopAccess({...shop,legacyWorkspaceId:null},'workspace-a').manageOwnCommerce,false);
 assert.equal(shopAccess({...shop,active:false},'workspace-a').mayOpenTeam,false);
 assert.equal(shopAccess({...shop,active:false},'workspace-a').manageOwnCommerce,false);
});
