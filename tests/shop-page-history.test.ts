import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialPageContent,changePageInput} from '../modules/shops/page-content';
import {appendPageHistory,readPageHistory,summarizePageRevision,type PageRevision} from '../modules/shops/page-history';

test('page history bounds complete snapshots to twenty without changing previous versions',()=>{
 const first:PageRevision={id:randomUUID(),version:0,action:'create',createdAt:new Date().toISOString(),content:initialPageContent('Notre histoire')};
 let history=[first];const original=JSON.stringify(first);
 for(let version=1;version<=20;version++)history=appendPageHistory(history,{...first,id:randomUUID(),version,action:'save',content:{...first.content,title:'Version '+version,language:'ar'}});
 assert.equal(history.length,20);assert.equal(history[0].version,1);assert.equal(history[19].version,20);assert.equal(history[0].content.language,'ar');assert.equal(JSON.stringify(first),original);
});
test('older page publications can have an unknown version and summaries omit full private content',()=>{
 const content=initialPageContent();content.description='Description privée';
 const entry:PageRevision={id:randomUUID(),version:null,createdAt:new Date().toISOString(),action:'publishedCheckpoint',content};
 assert.equal(readPageHistory([entry])[0].version,null);const summary=summarizePageRevision(entry);assert.equal('content' in summary,false);assert.equal(JSON.stringify(summary).includes('Description privée'),false);assert.equal(summary.sections,1);assert.deepEqual(readPageHistory(null),[]);
 for(const invalid of [[{...entry,content:{}}],[{...entry,id:'unsafe'}],[{...entry,version:-1}],Array(21).fill(entry)])assert.throws(()=>readPageHistory(invalid));
});
test('page revision restore input forbids changing the slug, content or expected version contract',()=>{
 const input={action:'restoreRevision',version:4,revisionId:randomUUID()};assert.equal(changePageInput.safeParse(input).success,true);
 for(const value of [{...input,slug:'another'},{...input,content:initialPageContent()},{...input,revisionId:'invalid'},{...input,version:1.5},{action:'restoreRevision',version:1}])assert.equal(changePageInput.safeParse(value).success,false);
});
