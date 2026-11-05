import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantOrdersCsv} from '../modules/shops/merchant-order-export';

test('private merchant order CSV exports all matching rows without buyer PII',()=>{
 const rows=Array.from({length:235},(_,i)=>({
  reference:'TC-'+i,status:i%2?'SHIPPED':'CONFIRMED',total:12500,
  source:'Boutique',createdAt:'2026-11-05T08:00:00Z',
  items:[{name:'T-shirt',quantity:2}],customerSnapshot:{
   phone:'22123456',name:'Acheteur secret',address:'Adresse privée'
  }
 }));
 const csv=merchantOrdersCsv(rows);
 assert.equal(csv.split('\r\n').filter(Boolean).length,236);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.match(csv,/TC-234/);
 assert.match(csv,/12\.500/);
 for(const privateField of ['22123456','Acheteur secret','Adresse privée'])
  assert.equal(csv.includes(privateField),false);
});
test('CSV neutralizes spreadsheet formula injection and unknown control prefixes',()=>{
 const csv=merchantOrdersCsv([{reference:'\u200b=HYPERLINK("https://evil.invalid")',
  status:'TO_CONFIRM',total:12000,source:'+DANGEROUS',
  createdAt:'2026-11-05',items:[{name:'-INJECTION',quantity:1}]}]);
 assert.ok(csv.includes('"\'=HYPERLINK(""https://evil.invalid"")"'));
 assert.ok(csv.includes('"\'+DANGEROUS"'));
 assert.ok(csv.includes('"\'-INJECTION × 1"'));
 assert.throws(()=>merchantOrdersCsv([{reference:'TC',status:'TO_CONFIRM',total:NaN,source:'',
  createdAt:'',items:[]}]),/invalide/);
});
