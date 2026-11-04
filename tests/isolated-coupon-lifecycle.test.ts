import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {couponMutation} from '../modules/shops/merchant-coupons';

function shop(){
 const s=initialState(false);
 s.products=[{id:'p',name:'Article',sku:'A',category:'Mode',variant:'',price:20000,cost:7000,stock:5,threshold:1,color:'#ffffff',active:true}];
 return applyAction(s,'coupon',{code:'PROMO10',percent:10,limit:10});
}
test('merchant can revoke a coupon without changing previous orders or usage count',()=>{
 const s=shop(),couponId=s.coupons[0].id;
 const disabled=applyAction(s,'setCouponActive',{id:couponId,active:false});
 assert.equal(disabled.coupons[0].active,false);
 assert.equal(s.coupons[0].active,true);
 assert.equal(disabled.coupons[0].used,0);
 assert.throws(()=>applyAction(disabled,'createOrder',{name:'Client',phone:'22123456',city:'Gabès',
  address:'Adresse privée',source:'Boutique',items:[{productId:'p',quantity:1}],coupon:'PROMO10'}),/Coupon invalide/);
 const again=applyAction(disabled,'setCouponActive',{id:couponId,active:true});
 const order=applyAction(again,'createOrder',{name:'Client',phone:'22123456',city:'Gabès',
  address:'Adresse privée',source:'Boutique',items:[{productId:'p',quantity:1}],coupon:'PROMO10'});
 assert.equal(order.coupons[0].used,1);
 assert.equal(order.orders[0].discount,2000);
});
test('strict lifecycle request rejects forged fields and invalid identifiers',()=>{
 const body={action:'setCouponActive',requestId:crypto.randomUUID(),payload:{id:crypto.randomUUID(),active:false}};
 assert.equal(couponMutation.safeParse(body).success,true);
 assert.equal(couponMutation.safeParse({...body,payload:{...body.payload,used:0}}).success,false);
 assert.equal(couponMutation.safeParse({...body,payload:{...body.payload,id:'other'}}).success,false);
 const s=shop();
 assert.throws(()=>applyAction(s,'setCouponActive',{id:crypto.randomUUID(),active:false}),/introuvable/);
 assert.throws(()=>applyAction(s,'setCouponActive',{id:s.coupons[0].id,active:true}),/déjà/);
});
