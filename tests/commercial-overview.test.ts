import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {commercialOverview,mayReadOwnCommercialOverview} from '../modules/shops/commercial-overview';

test('shop overview must require active membership, OWN role and exact owner',()=>{
 const base={active:true,role:'OWNER',workspaceOwnerId:'merchant-a',userId:'merchant-a'};
 assert.equal(mayReadOwnCommercialOverview(base),true);
 assert.equal(mayReadOwnCommercialOverview({...base,role:'ADMIN'}),false);
 assert.equal(mayReadOwnCommercialOverview({...base,role:'VIEWER'}),false);
 assert.equal(mayReadOwnCommercialOverview({...base,userId:'merchant-b'}),false);
 assert.equal(mayReadOwnCommercialOverview({...base,active:false}),false);
 assert.equal(mayReadOwnCommercialOverview({...base,workspaceOwnerId:null}),false);
});
test('overview aggregates only supplied workspace and avoids exposing customer contacts',()=>{
 const state=initialState(false);
 const summary=commercialOverview(state);
 assert.equal(summary.products,state.products.length);
 assert.equal(summary.orders,state.orders.length);
 assert.equal(summary.customers,state.customers.length);
 assert.equal('phone' in summary,false);
 assert.equal('email' in summary,false);
 assert.equal('ordersDetail' in summary,false);
});
