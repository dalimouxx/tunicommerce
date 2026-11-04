import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../modules/commerce/seed';
import {applyAction} from '../modules/commerce/service';
import {parseCatalogCsv,catalogImportPayload} from '../modules/commerce/catalog-import';
import {bulkCatalogImportRequest} from '../modules/shops/bulk-catalog-import';

const source='sku;name;category;variant;priceTnd;costTnd;stock;threshold\n' +
 'A-01;"T-shirt; manches courtes";Mode;Rouge;35,500;17.000;12;3\n' +
 'A-02;Jean;Mode;Bleu;99.000;48.500;5;2\n';
test('CSV parser accepts quoted fields, semicolon separator, TND precision',()=>{
 const rows=parseCatalogCsv(source);
 assert.equal(rows.length,2);
 assert.equal(rows[0].name,'T-shirt; manches courtes');
 assert.equal(rows[0].price,35500);
 assert.equal(rows[1].cost,48500);
 assert.equal(rows[0].stock,12);
});
test('all products import atomically with one movement per initial stock',()=>{
 const initial=initialState(false),original=JSON.stringify(initial);
 const rows=parseCatalogCsv(source);
 const next=applyAction(initial,'importProducts',{rows});
 assert.equal(next.products.length,2);
 assert.equal(next.products[0].stock,12);
 assert.equal(next.products[1].stock,5);
 assert.equal(next.movements.length,2);
 assert.equal(next.audit.length,1);
 assert.equal(JSON.stringify(initial),original);
});
test('duplicate existing or repeated SKU blocks entire import without partial mutation',()=>{
 const s=applyAction(initialState(false),'importProducts',{rows:parseCatalogCsv(source)});
 const before=JSON.stringify(s);
 assert.throws(()=>applyAction(s,'importProducts',{rows:parseCatalogCsv(source)}),/SKU déjà/);
 assert.equal(JSON.stringify(s),before);
 const duplicate=parseCatalogCsv(source);duplicate[1].sku='a-01';
 assert.throws(()=>applyAction(initialState(false),'importProducts',{rows:duplicate}),/SKU déjà/);
});
test('strict payload and invalid CSV reject injection/unsafe numbers/oversized batches',()=>{
 const rows=parseCatalogCsv(source);
 assert.equal(bulkCatalogImportRequest.safeParse({action:'importProducts',requestId:crypto.randomUUID(),payload:{rows}}).success,true);
 assert.equal(bulkCatalogImportRequest.safeParse({action:'importProducts',requestId:crypto.randomUUID(),payload:{rows,tenantId:'other'}}).success,false);
 assert.throws(()=>parseCatalogCsv(source.replace('35,500','1e9')),/Montant TND/);
 assert.throws(()=>parseCatalogCsv(source.replace('12;3','-10;3')),/Quantité entière/);
 assert.equal(catalogImportPayload.safeParse({rows:Array(101).fill(rows[0])}).success,false);
});
test('invalid data must fail before applying any stock movement',()=>{
 const s=initialState(false),before=JSON.stringify(s);
 assert.throws(()=>applyAction(s,'importProducts',{rows:[{sku:'FAIL',name:'A',category:'Mode',variant:'',price:1000,cost:100,stock:-2,threshold:2}]}));
 assert.equal(JSON.stringify(s),before);
});
