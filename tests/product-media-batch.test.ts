import test from 'node:test';
import assert from 'node:assert/strict';
import {planPhotoBatch,batchSummary} from '../modules/product-media/batch';

test('a batch is cut to the free space of the library',()=>{
 assert.deepEqual(planPhotoBatch(10,25,30),{accepted:5,skipped:5});
 assert.deepEqual(planPhotoBatch(3,0,30),{accepted:3,skipped:0});
 assert.deepEqual(planPhotoBatch(4,30,30),{accepted:0,skipped:4});
 assert.deepEqual(planPhotoBatch(0,2,30),{accepted:0,skipped:0});
});
test('the summary names failed files and skipped photos',()=>{
 assert.equal(batchSummary({imported:5,failed:[],skipped:0}),'5 photos importées.');
 assert.equal(batchSummary({imported:1,failed:[],skipped:0}),'1 photo importée.');
 assert.equal(batchSummary({imported:3,failed:['plage.heic','scan.png'],skipped:2}),'3 photos importées. Échec : plage.heic, scan.png. 2 photos ignorées : bibliothèque pleine (30 maximum).');
 assert.equal(batchSummary({imported:0,failed:['a.gif'],skipped:0}),'Aucune photo importée. Échec : a.gif.');
});
