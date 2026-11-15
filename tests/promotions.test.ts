import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {publicCatalog} from '../modules/platform/public';
import {activePromotion,assertValidPromotion,effectivePrice,promotionView,productPromotionMutation,tunisLocalToIso} from '../modules/shops/promotions';

const hour=3600_000;
const iso=(offset:number)=>new Date(Date.now()+offset).toISOString();
const order={name:'Amira Ben Ali',phone:'22123456',city:'Tunis',address:'Rue de Marseille',source:'Boutique'};
function withPromotion(price:number,startsAt=iso(-hour),endsAt=iso(24*hour)){
 const state=initialState(true);
 return applyAction(state,'productPromotion',{productId:'p1',promotion:{price,startsAt,endsAt}});
}

test('Tunis local time converts to UTC (UTC+1, no daylight saving)',()=>{
 assert.equal(tunisLocalToIso('2026-11-20T23:59'),'2026-11-20T22:59:00.000Z');
 assert.equal(tunisLocalToIso('2026-07-01T10:00'),'2026-07-01T09:00:00.000Z');
 assert.throws(()=>tunisLocalToIso('demain'));
});
test('a promotion must be cheaper, end after it starts and end in the future',()=>{
 const now=new Date();
 assert.throws(()=>assertValidPromotion(89000,{price:89000,startsAt:iso(0),endsAt:iso(hour)},now),/inférieur/);
 assert.throws(()=>assertValidPromotion(89000,{price:50000,startsAt:iso(hour),endsAt:iso(0)},now),/après/);
 assert.throws(()=>assertValidPromotion(89000,{price:50000,startsAt:iso(-3*hour),endsAt:iso(-hour)},now),/futur/);
 assert.doesNotThrow(()=>assertValidPromotion(89000,{price:50000,startsAt:iso(-hour),endsAt:iso(hour)},now));
 assert.equal(productPromotionMutation.safeParse({action:'productPromotion',requestId:crypto.randomUUID(),payload:{productId:'p1',promotion:{price:1,startsAt:'x',endsAt:'y'}}}).success,false);
 assert.equal(productPromotionMutation.safeParse({action:'productPromotion',requestId:crypto.randomUUID(),payload:{productId:'p1',promotion:null}}).success,true);
});
test('the promotional price applies only inside its window and only while cheaper',()=>{
 const now=new Date();
 const product={price:89000,promotion:{price:69000,startsAt:iso(-hour),endsAt:iso(hour)}};
 assert.equal(effectivePrice(product,now),69000);
 assert.equal(effectivePrice(product,new Date(Date.now()+hour)),89000,'ends exactly at endsAt');
 assert.equal(effectivePrice({...product,promotion:{...product.promotion,startsAt:iso(hour),endsAt:iso(2*hour)}},now),89000,'not started');
 assert.equal(activePromotion({price:60000,promotion:product.promotion},now),null,'regular price lowered below promo');
 assert.deepEqual(promotionView(product,now),{regularPrice:89000,endsAt:product.promotion.endsAt,percent:22});
 assert.equal(promotionView({price:89000},now),null);
});
test('orders are charged the promotional price computed by the server',()=>{
 const state=withPromotion(69000);
 const next=applyAction(state,'createOrder',{...order,items:[{productId:'p1',quantity:2}]});
 const created=next.orders[0];
 assert.equal(created.items[0].price,69000);
 assert.equal((created.items[0] as {regularPrice?:number}).regularPrice,89000);
 assert.equal(created.subtotal,138000);
 assert.ok(created.events.some(event=>/Promotion/.test(event.label)));
});
test('an ended promotion falls back to the regular price at checkout',()=>{
 const state=withPromotion(69000);
 state.products.find(p=>p.id==='p1')!.promotion={price:69000,startsAt:iso(-3*hour),endsAt:iso(-1000)};
 const next=applyAction(state,'createOrder',{...order,items:[{productId:'p1',quantity:1}]});
 assert.equal(next.orders[0].items[0].price,89000);
 assert.equal((next.orders[0].items[0] as {regularPrice?:number}).regularPrice,undefined);
});
test('quantity offers apply only when cheaper than the promotional price',()=>{
 let state=withPromotion(69000);
 state=applyAction(state,'quantityOffers',{productId:'p1',offers:[{quantity:2,price:150000,label:'Duo'}]});
 const order2=applyAction(state,'createOrder',{...order,items:[{productId:'p1',quantity:2}]}).orders[0];
 assert.equal(order2.subtotal-order2.discount,138000,'promo 2×69 beats the 150 duo offer');
 const catalog=publicCatalog(state).products.find(p=>p.id==='p1')!;
 assert.equal(catalog.price,69000);
 assert.deepEqual(catalog.offers,[]);
 assert.equal(catalog.promotion?.regularPrice,89000);
});
test('a merchant can stop a promotion and unknown products are refused',()=>{
 const stopped=applyAction(withPromotion(69000),'productPromotion',{productId:'p1',promotion:null});
 assert.equal(stopped.products.find(p=>p.id==='p1')!.promotion,undefined);
 assert.throws(()=>applyAction(initialState(true),'productPromotion',{productId:'nope',promotion:null}),/introuvable/);
});
test('merchant view lists active products with their promotion status in Tunis time',async()=>{
 const {merchantPromotionsView}=await import('../modules/shops/promotions');
 const state=withPromotion(69000,'2026-11-01T09:00:00.000Z',new Date(Date.now()+24*hour).toISOString());
 const view=merchantPromotionsView(state.products,new Date());
 const p1=view.find(item=>item.id==='p1')!;
 assert.equal(p1.status,'ACTIVE');assert.equal(p1.promotion?.price,69000);assert.equal(p1.promotion?.startsLocal,'2026-11-01T10:00');
 assert.equal(view.find(item=>item.id!=='p1')!.status,'NONE');
 const scheduled=merchantPromotionsView([{id:'x',name:'X',variant:'',price:1000,active:true,promotion:{price:500,startsAt:iso(hour),endsAt:iso(2*hour)}}],new Date());
 assert.equal(scheduled[0].status,'SCHEDULED');
 const ended=merchantPromotionsView([{id:'x',name:'X',variant:'',price:1000,active:true,promotion:{price:500,startsAt:iso(-2*hour),endsAt:iso(-hour)}}],new Date());
 assert.equal(ended[0].status,'ENDED');
 assert.equal(merchantPromotionsView([{id:'x',name:'X',variant:'',price:1000,active:false}],new Date()).length,0);
});
