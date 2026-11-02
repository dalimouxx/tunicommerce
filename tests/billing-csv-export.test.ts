import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {csvCell,csvRow,millimesToTnd} from '../modules/billing/csv-export';

test('CSV escapes embedded quotes and commas',()=>{
 assert.equal(csvCell('Test, "service"'),'"Test, ""service"""');
});
test('CSV protects formulas in untrusted merchant fields',()=>{
 for(const value of ['=1+1','+SUM(A1:A2)','-2+3','@evil','\t=HYPERLINK("x")']){
  assert.ok(csvCell(value).startsWith('"\''),value);
 }
});
test('CSV removes CR/LF to prevent injected rows',()=>{
 assert.equal(csvCell('first\r\nsecond'),'"first  second"');
 assert.equal(csvRow(['A','B']),'"A","B"\r\n');
});
test('TND conversion uses exactly three decimals',()=>{
 assert.equal(millimesToTnd(12500),'12.500');
 assert.equal(millimesToTnd(1),'0.001');
 assert.throws(()=>millimesToTnd(-1));
});
