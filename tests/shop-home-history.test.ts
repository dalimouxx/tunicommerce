import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialHomeContent,changeHomeInput} from '../modules/shops/home-content';
import {appendHomeHistory,readHomeHistory,summarizeHomeRevision,type HomeRevision} from '../modules/shops/home-history';

test('history retains the latest twenty complete bilingual states without mutating previous entries',()=>{
 const content=initialHomeContent();content.fr.heroTitle='Ancienne collection';content.ar.heroTitle='مجموعة';
 const first:HomeRevision={id:randomUUID(),version:1,createdAt:new Date().toISOString(),action:'save',content};
 let history=[first];const original=JSON.stringify(history);
 for(let version=2;version<=21;version++)history=appendHomeHistory(history,{...first,id:randomUUID(),version,content:{...content,fr:{...content.fr,heroTitle:'Version '+version}}});
 assert.equal(history.length,20);assert.equal(history[0].version,2);assert.equal(history[19].version,21);assert.equal(JSON.stringify([first]),original);assert.equal(readHomeHistory(history)[0].content.ar.heroTitle,'مجموعة');
});
test('history summaries omit content and malformed history fails closed',()=>{
 const content=initialHomeContent();content.fr.heroDescription='Texte privé';
 const revision:HomeRevision={id:randomUUID(),version:3,createdAt:new Date().toISOString(),action:'publish',content};
 const summary=summarizeHomeRevision(revision);assert.equal('content' in summary,false);assert.equal(JSON.stringify(summary).includes('Texte privé'),false);assert.deepEqual(readHomeHistory(null),[]);
 for(const bad of [[{...revision,content:{}}],[{...revision,id:'foreign'}],[{...revision,action:'delete'}],Array(21).fill(revision)])assert.throws(()=>readHomeHistory(bad));
});
test('restoring a revision requires a UUID and the exact expected version without arbitrary content',()=>{
 const input={action:'restoreRevision',version:3,revisionId:randomUUID()};assert.equal(changeHomeInput.safeParse(input).success,true);
 for(const value of [{...input,version:-1},{...input,revisionId:'unsafe'},{...input,content:initialHomeContent()},{action:'restoreRevision',version:3}])assert.equal(changeHomeInput.safeParse(value).success,false);
});
