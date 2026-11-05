import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {linePrice,offerForQuantity,publicQuantityOffers,quantityOffersPayload} from '../modules/shops/quantity-offers';
import {publicProductDetail} from '../modules/shops/public-product-detail';

function shop(){
 const state=initialState(false);
 state.shop.shipping=8000;state.zones=[];
 state.products=[{id:'p1',name:'Crème',sku:'C-1',category:'Beauté',variant:'',price:49000,cost:20000,
  stock:50,threshold:1,color:'#fff',active:true}];
 state.coupons=[{id:'c1',code:'PROMO10',percent:10,limit:10,used:0,active:true} as any];
 return applyAction(state,'quantityOffers',{productId:'p1',offers:[
  {quantity:3,price:119000,label:'Meilleure offre'},{quantity:2,price:89000,label:''}]});
}
const order=(state:ReturnType<typeof shop>,quantity:number,coupon?:string)=>
 applyAction(state,'createOrder',{name:'Client Test',phone:'22123456',city:'Tunis',address:'Rue Test',
  source:'Boutique',items:[{productId:'p1',quantity}],...(coupon?{coupon}:{})}).orders[0];

test('offers are validated: cheaper than unit price, unique quantity, 4 max',()=>{
 const state=initialState(false);
 state.products=[{id:'p1',name:'Crème',sku:'C-1',category:'',variant:'',price:49000,cost:1,stock:5,threshold:1,color:'#fff',active:true}];
 assert.throws(()=>applyAction(state,'quantityOffers',{productId:'p1',offers:[{quantity:2,price:98000,label:''}]}),/moins de 98.000/);
 assert.throws(()=>applyAction(state,'quantityOffers',{productId:'p1',offers:[{quantity:1,price:40000,label:''}]}));
 assert.throws(()=>applyAction(state,'quantityOffers',{productId:'zz',offers:[]}),/introuvable/);
 assert.equal(quantityOffersPayload.safeParse({productId:'p1',offers:[{quantity:2,price:1,label:''},{quantity:2,price:2,label:''}]}).success,false);
 assert.equal(quantityOffersPayload.safeParse({productId:'p1',offers:[2,3,4,5,6].map(q=>({quantity:q,price:1,label:''}))}).success,false);
 const cleared=applyAction(shop(),'quantityOffers',{productId:'p1',offers:[]});
 assert.deepEqual(cleared.products[0].quantityOffers,[]);
});

test('server applies the exact-quantity offer and records it on the order',()=>{
 const state=shop();
 assert.deepEqual(state.products[0].quantityOffers!.map(o=>o.quantity),[2,3]);
 const two=order(state,2);
 assert.equal(two.subtotal,98000);assert.equal(two.discount,9000);assert.equal(two.offerDiscount,9000);
 assert.equal(two.total,89000+8000);
 assert.ok(two.events.some(e=>e.label.includes('Offre quantité : 2 × Crème à 89.000 TND')));
 const three=order(state,3);assert.equal(three.total,119000+8000);
 const four=order(state,4);assert.equal(four.discount,0);assert.equal(four.offerDiscount,undefined);
 assert.equal(order(state,1).total,49000+8000);
});

test('a coupon applies to the amount after the quantity offer',()=>{
 const two=order(shop(),2,'PROMO10');
 assert.equal(two.discount,9000+8900);
 assert.equal(two.total,98000-17900+8000);
});

test('an offer that became more expensive after a price drop is ignored',()=>{
 const state=shop();state.products[0].price=40000;
 assert.equal(offerForQuantity(state.products[0],2),null);
 assert.equal(order(state,2).total,80000+8000);
 assert.equal(linePrice(state.products[0],3).saving,1000);
});

test('public projection lists 1 piece then offers with savings, without cost or stock',()=>{
 const detail=publicProductDetail(shop(),'p1')!;
 assert.deepEqual(detail.product.offers,[
  {quantity:1,price:49000,label:'',saving:0},
  {quantity:2,price:89000,label:'',saving:9000},
  {quantity:3,price:119000,label:'Meilleure offre',saving:28000}]);
 const json=JSON.stringify(detail);
 assert.equal(json.includes('20000'),false);assert.equal(json.includes('"stock"'),false);
 assert.deepEqual(publicQuantityOffers({price:1000}),[]);
});
