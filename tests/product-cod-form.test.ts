import test from 'node:test';
import assert from 'node:assert/strict';
import {
 offerLineTotal,clampQuantity,estimateDelivery,fastestDeliveryDays,formatTunisianPhone,
 isValidTunisianMobile,normalizeTunisianPhone,productOrderSummary
} from '../modules/shops/product-cod-form';

const zones=[
 {governorates:['Tunis','Ariana'],fee:7000,freeAbove:150000,estimatedDays:1},
 {governorates:['Sfax'],fee:9000,freeAbove:null,estimatedDays:3}
];

test('Tunisian phone numbers are normalized from common typing habits',()=>{
 assert.equal(normalizeTunisianPhone('22 123 456'),'22123456');
 assert.equal(normalizeTunisianPhone('+216 22.123.456'),'22123456');
 assert.equal(normalizeTunisianPhone('00216-55-123-456'),'55123456');
 assert.equal(normalizeTunisianPhone('21622123456'),'22123456');
 assert.equal(isValidTunisianMobile('98 765 432'),true);
 assert.equal(isValidTunisianMobile('41 234 567'),true);
 assert.equal(isValidTunisianMobile('71 234 567'),false);
 assert.equal(isValidTunisianMobile('2212345'),false);
 assert.equal(formatTunisianPhone('+21622123456'),'22 123 456');
});

test('quantity stays within the public checkout bounds',()=>{
 assert.equal(clampQuantity(0),1);
 assert.equal(clampQuantity(3.7),3);
 assert.equal(clampQuantity(99),10);
 assert.equal(clampQuantity(Number.NaN),1);
});

test('delivery follows zone fees, free thresholds and the shop default',()=>{
 assert.deepEqual(estimateDelivery(50000,'Tunis',zones,8000),{fee:7000,free:false,estimatedDays:1,known:true});
 assert.equal(estimateDelivery(150000,'Ariana',zones,8000).fee,0);
 assert.equal(estimateDelivery(150000,'Ariana',zones,8000).free,true);
 assert.equal(estimateDelivery(500000,'Sfax',zones,8000).fee,9000);
 assert.deepEqual(estimateDelivery(10000,'Gafsa',zones,8000),{fee:8000,free:false,estimatedDays:null,known:true});
 assert.equal(estimateDelivery(10000,'',zones,8000).known,false);
});

test('order summary multiplies the unit price and adds delivery',()=>{
 const summary=productOrderSummary(39900,2,'Sfax',zones,8000);
 assert.equal(summary.subtotal,79800);
 assert.equal(summary.total,88800);
 assert.equal(productOrderSummary(80000,2,'Tunis',zones,8000).total,160000);
 assert.equal(fastestDeliveryDays(zones),1);
 assert.equal(fastestDeliveryDays([]),null);
});

test('quantity offers lower the displayed subtotal exactly like the server',()=>{
 const offers=[{quantity:2,price:89000},{quantity:3,price:119000}];
 assert.deepEqual(offerLineTotal(49000,2,offers),{full:98000,total:89000,saving:9000});
 assert.equal(offerLineTotal(49000,4,offers).saving,0);
 assert.equal(offerLineTotal(40000,3,[{quantity:3,price:125000}]).saving,0);
 const summary=productOrderSummary(49000,3,'Sfax',zones,8000,offers);
 assert.equal(summary.subtotal,119000);assert.equal(summary.saving,28000);assert.equal(summary.total,128000);
 // free delivery threshold (150) is checked after the offer: 3 × 52 = 156 but offer 140 → paid delivery
 assert.equal(productOrderSummary(52000,3,'Tunis',zones,8000,[{quantity:3,price:140000}]).delivery.fee,7000);
});
