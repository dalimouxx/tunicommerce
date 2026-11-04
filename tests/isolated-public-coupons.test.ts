import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {publicCodCheckoutInput} from '../modules/shops/public-cod-checkout';
import {couponMutation,merchantCouponsView} from '../modules/shops/merchant-coupons';
function shop(){
 const s=initialState(false);
 s.products=[{id:'p',name:'Article',sku:'ARTICLE',category:'Mode',variant:'',price:20000,cost:9000,stock:5,threshold:1,color:'#ffffff',active:true}];
 return s;
}
test('COD coupon discount is computed server-side, consumes one use and remains shop-local',()=>{
 const initial=shop(),other=shop();
 let next=applyAction(initial,'coupon',{code:'PROMO20',percent:20,limit:1});
 next=applyAction(next,'createOrder',{name:'Client',phone:'22123456',city:'Tunis',address:'Adresse',
  source:'Boutique',items:[{productId:'p',quantity:2}],coupon:'PROMO20'});
 assert.equal(next.orders[0].subtotal,40000);
 assert.equal(next.orders[0].discount,8000);
 assert.equal(next.orders[0].total,40000-8000+next.orders[0].shipping);
 assert.equal(next.coupons[0].used,1);
 assert.throws(()=>applyAction(next,'createOrder',{name:'Client 2',phone:'22123457',city:'Tunis',
  address:'Adresse',source:'Boutique',items:[{productId:'p',quantity:1}],coupon:'PROMO20'}),/épuisé/);
 assert.equal(other.coupons.length,0);
 assert.equal(initial.coupons.length,0);
});
test('checkout coupon optional but no client discount or price accepted',()=>{
 const input={requestId:crypto.randomUUID(),name:'Client',phone:'22123456',city:'Tunis',address:'Adresse',
  items:[{productId:'p',quantity:1}],coupon:'PROMO20'};
 assert.equal(publicCodCheckoutInput.safeParse(input).success,true);
 assert.equal(publicCodCheckoutInput.safeParse({...input,discount:100000}).success,false);
 assert.equal(publicCodCheckoutInput.safeParse({...input,coupon:'<script>alert(1)</script>'}).success,false);
});
test('owner coupon validation and projection omit customer data',()=>{
 const req={action:'coupon',requestId:crypto.randomUUID(),payload:{code:'TEST10',percent:10,limit:100}};
 assert.equal(couponMutation.safeParse(req).success,true);
 assert.equal(couponMutation.safeParse({...req,payload:{...req.payload,percent:80}}).success,false);
 const s=applyAction(shop(),'coupon',req.payload);
 assert.equal(merchantCouponsView(s).coupons[0].remaining,100);
});
