import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialHomeContent,homeContent} from '../modules/shops/home-content';
import {mergeHomeDraft,parseHomeRecovery,homeRecoveryKey,homeValidationMessage,homeEditorRequest,HomeRequestError} from '../modules/shops/home-editor-state';

test('concurrent changes in separate fields and languages survive a three-way merge',()=>{
 const base=initialHomeContent(),mine=structuredClone(base),theirs=structuredClone(base);mine.fr.heroTitle='Ma marque';mine.sectionsPosition='afterCatalog';theirs.ar.announcement='متجرنا';theirs.fr.heroDescription='Présentation du serveur';
 const result=mergeHomeDraft(base,mine,theirs);assert.deepEqual(result.conflicts,[]);assert.equal(result.content.fr.heroTitle,'Ma marque');assert.equal(result.content.fr.heroDescription,theirs.fr.heroDescription);assert.equal(result.content.ar.announcement,theirs.ar.announcement);assert.equal(result.content.sectionsPosition,'afterCatalog');
});
test('the same change made in two tabs is already synchronized',()=>{
 const base=initialHomeContent(),changed=structuredClone(base);changed.fr.heroTitle='Même titre';const merged=mergeHomeDraft(base,changed,structuredClone(changed));assert.deepEqual(merged.conflicts,[]);assert.deepEqual(merged.content,changed);
});
test('different edits to the same field conflict without mutating either version',()=>{
 const base=initialHomeContent(),mine=structuredClone(base),theirs=structuredClone(base);mine.fr.heroTitle='Mon texte';theirs.fr.heroTitle='Autre texte';const snapshot=structuredClone({base,mine,theirs});
 const merged=mergeHomeDraft(base,mine,theirs);assert.deepEqual(merged.conflicts,['fr.heroTitle']);assert.deepEqual({base,mine,theirs},snapshot);
});
test('section reorder and deletion are atomic and never merge by array index',()=>{
 const base=initialHomeContent();base.fr.sections=[{id:randomUUID(),type:'text',title:'A',text:'Alpha'},{id:randomUUID(),type:'text',title:'B',text:'Beta'}];
 const mine=structuredClone(base),theirs=structuredClone(base);mine.fr.sections.reverse();theirs.fr.sections.pop();const merged=mergeHomeDraft(base,mine,theirs);assert.deepEqual(merged.conflicts,['fr.sections']);assert.equal(merged.content.fr.sections.length,2);
});
test('a local recovery copy preserves unfinished invalid fields for later correction',()=>{
 const base=initialHomeContent(),content=structuredClone(base);content.ar.sections=[{id:randomUUID(),type:'faq',title:'',items:[{question:'',answer:''}]}];assert.equal(homeContent.safeParse(content).success,false);
 const saved={format:1,savedAt:Date.now(),version:0,base,content};const restored=parseHomeRecovery(JSON.stringify(saved));assert.ok(restored);assert.deepEqual(restored.content,content);
});
test('local recovery rejects corrupted, oversized, expired, future and executable payloads',()=>{
 const now=Date.now(),base=initialHomeContent(),valid={format:1,savedAt:now,version:0,base,content:base};
 for(const raw of ['{','x'.repeat(1200001),JSON.stringify({...valid,savedAt:now-86400001}),JSON.stringify({...valid,savedAt:now+300001}),JSON.stringify({...valid,content:{...base,script:'alert(1)'}})])assert.equal(parseHomeRecovery(raw,now),null);
});
test('local drafts are scoped by both signed-in account and shop',()=>{
 assert.notEqual(homeRecoveryKey('user-a','shop'),homeRecoveryKey('user-b','shop'));assert.notEqual(homeRecoveryKey('user-a','shop-a'),homeRecoveryKey('user-a','shop-b'));
});
test('an invalid hidden Arabic field is named precisely instead of a generic save error',()=>{
 const home=initialHomeContent();home.ar.sections=[{id:randomUUID(),type:'text',title:'',text:'Texte'}];const parsed=homeContent.safeParse(home);assert.equal(parsed.success,false);if(parsed.success)return;
 assert.match(homeValidationMessage(parsed.error.issues[0]),/AR · sections · nº 1 · titre/);assert.match(homeValidationMessage(parsed.error.issues[0]),/Renseigne ce champ/);
});
test('expired sessions and HTML failures produce usable messages; malformed success is refused',async()=>{
 const signal=new AbortController().signal;
 await assert.rejects(homeEditorRequest('/home',undefined,signal,async()=>Response.json({error:'Connexion requise'},{status:401})),error=>error instanceof HomeRequestError&&error.status===401&&error.message.includes('session'));
 await assert.rejects(homeEditorRequest('/home',undefined,signal,async()=>new Response('<html>upstream error</html>',{status:503})),error=>error instanceof HomeRequestError&&!error.message.includes('<html>'));
 await assert.rejects(homeEditorRequest('/home',undefined,signal,async()=>Response.json({version:1})),/Réponse incomplète/);
});

