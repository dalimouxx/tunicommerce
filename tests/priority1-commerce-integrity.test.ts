import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {commerceIntegrity,mergeCommerceIntegrity,parseIntegrityPage,integrityTotalPages} from '../modules/platform/commerce-integrity';

test('integrity detector summarizes stock and duplicate tokens without PII',()=>{
 const s=initialState(false);
 s.products=[
  {id:'P',sku:'AbC',name:'SECRET NAME',category:'Mode',variant:'',price:10000,cost:4000,stock:3,threshold:1,color:'#ffffff',active:true},
  {id:'P',sku:' abc ',name:'OTHER',category:'Mode',variant:'',price:10000,cost:4000,stock:-1,threshold:1,color:'#ffffff',active:true}
 ];
 s.orders=[{id:'ORDER',reference:'SECRET-ORDER',publicReceiptId:'shared',
  customerSnapshot:{name:'CLIENT PRIVATE',phone:'22123456'}} as never,
  {id:'ORDER',reference:'SECRET-2',publicReceiptId:'shared'} as never];
 s.warehouses=[{id:'primary',code:'MAIN',name:'Main',active:true}];
 s.warehouseBalances=[{productId:'P',warehouseId:'unknown',quantity:-2}];
 const summary=commerceIntegrity(s);
 const get=(code:string)=>summary.findings.find(x=>x.code===code)?.count;
 assert.equal(get('DUPLICATE_PRODUCT_ID'),1);
 assert.equal(get('DUPLICATE_SKU'),1);
 assert.equal(get('NEGATIVE_STOCK'),1);
 assert.equal(get('DUPLICATE_CHECKOUT_TOKEN'),1);
 assert.equal(get('DUPLICATE_ORDER_ID'),1);
 assert.equal(get('INVALID_WAREHOUSE_REFERENCE'),1);
 assert.equal(get('NEGATIVE_WAREHOUSE_BALANCE'),1);
 assert.ok(summary.problems>=7);
 const serialized=JSON.stringify(summary);
 for(const secret of ['SECRET NAME','CLIENT PRIVATE','22123456','SECRET-ORDER','AbC'])
  assert.equal(serialized.includes(secret),false);
});
test('legacy shops without warehouse ledger are not flagged for missing allocations',()=>{
 const s=initialState(false);
 s.products=[{id:'p',sku:'ABC',name:'Regular',category:'Mode',variant:'',
  price:10000,cost:4000,stock:7,threshold:1,color:'#ffffff',active:true}];
 const summary=commerceIntegrity(s);
 assert.equal(summary.problems,0);
 assert.equal(summary.checkedWarehouseLedger,false);
 assert.equal(mergeCommerceIntegrity([s,s]).checkedShops,2);
});

test('P1 global integrity navigation covers every shop page and rejects ambiguous selectors',()=>{
 assert.equal(parseIntegrityPage({}),1);
 assert.equal(parseIntegrityPage({page:'2'}),2);
 assert.equal(integrityTotalPages(0),1);
 assert.equal(integrityTotalPages(100),1);
 assert.equal(integrityTotalPages(101),2);
 assert.equal(integrityTotalPages(213),3);
 for(const input of [{page:'0'},{page:'10000'},{page:['1','2']},
  {page:''},{page:'-1'},{page:'1',token:'any'}])
  assert.throws(()=>parseIntegrityPage(input));
 assert.throws(()=>integrityTotalPages(-1));
});
