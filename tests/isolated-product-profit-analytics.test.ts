import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {productProfitAnalytics} from '../modules/shops/product-profit-analytics';
test('allocated discounts and returned cost make per-product contribution coherent',()=>{
 let s=initialState(false);
 s.products=[{id:'p',name:'Produit',sku:'SECRET-SKU',category:'Mode',variant:'',price:20000,cost:7000,
  stock:6,threshold:1,color:'#eeeeee',active:true}];
 s=applyAction(s,'coupon',{code:'REDUC10',percent:10,limit:10});
 s=applyAction(s,'createOrder',{name:'Client PII',phone:'22123456',city:'Gabès',address:'Adresse PII',
  source:'Boutique',items:[{productId:'p',quantity:2}],coupon:'REDUC10'});
 const id=s.orders[0].id;
 for(const status of ['CONFIRMED','PREPARING','READY'] as const)s=applyAction(s,'transition',{id,status});
 s=applyAction(s,'transition',{id,status:'SHIPPED',carrier:'Livreur manuel',tracking:'TRK-TEST'});
 s=applyAction(s,'transition',{id,status:'DELIVERED'});
 let row=productProfitAnalytics(s).products[0];
 assert.equal(row.grossSalesMillimes,40000);
 assert.equal(row.discountMillimes,4000);
 assert.equal(row.netProductRevenueMillimes,36000);
 assert.equal(row.costOfGoodsMillimes,14000);
 assert.equal(row.estimatedProductMarginMillimes,22000);
 s=applyAction(s,'receiveReturn',{orderId:id,productId:'p',quantity:1,reason:'Produit non conforme',
  condition:'RESELLABLE',returnCost:1000});
 row=productProfitAnalytics(s).products[0];
 assert.equal(row.creditsMillimes,18000);
 assert.equal(row.recoveredCostMillimes,7000);
 assert.equal(row.estimatedProductMarginMillimes,11000);
 const json=JSON.stringify(productProfitAnalytics(s));
 for(const secret of ['22123456','Client PII','Adresse PII','SECRET-SKU'])assert.equal(json.includes(secret),false);
});
test('non-delivered orders are excluded and unallocated advertising is not called profit',()=>{
 const s=initialState(false);
 s.expenses=[{id:'e',label:'Campagne',category:'Publicité',amount:50000,date:'2026-11-04'}];
 const result=productProfitAnalytics(s);
 assert.equal(result.summary.deliveredOrders,0);
 assert.equal(result.summary.unallocatedAdvertisingExpenseMillimes,50000);
 assert.equal(result.summary.estimatedProductMarginMillimes,0);
});
