import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {homeContent,initialHomeContent,changeHomeInput} from '../modules/shops/home-content';

test('an untouched home keeps all theme defaults and independent language arrays',()=>{
 const home=initialHomeContent();assert.equal(homeContent.safeParse(home).success,true);assert.equal(home.showBenefits,true);
 home.fr.sections.push({id:randomUUID(),type:'text',title:'Notre histoire',text:'Texte'});assert.equal(home.ar.sections.length,0);assert.equal(initialHomeContent().fr.sections.length,0);
});
test('home sections retain their order and are bounded per language',()=>{
 const home=initialHomeContent();home.fr.sections=Array.from({length:8},(_,i)=>({id:randomUUID(),type:'text' as const,title:'Section '+i,text:'Contenu'}));
 assert.deepEqual(homeContent.parse(home).fr.sections.map(s=>s.title),home.fr.sections.map(s=>s.title));home.fr.sections.push({...home.fr.sections[0],id:randomUUID()});assert.equal(homeContent.safeParse(home).success,false);
});
test('home rejects duplicate section IDs, executable fields and unsupported layout controls',()=>{
 const home=initialHomeContent(),section={id:randomUUID(),type:'cta' as const,title:'Découvrir',text:'Collection',label:'Catalogue'};home.fr.sections=[section,{...section}];assert.equal(homeContent.safeParse(home).success,false);
 home.fr.sections=[section];assert.equal(homeContent.safeParse({...home,css:'body{}'}).success,false);assert.equal(homeContent.safeParse({...home,fr:{...home.fr,sections:[{...section,url:'javascript:alert(1)'}]}}).success,false);assert.equal(homeContent.safeParse({...home,sectionsPosition:'replaceCheckout'}).success,false);
});
test('home size counts UTF-8 bytes across both languages',()=>{
 const home=initialHomeContent();home.fr.sections=Array.from({length:8},()=>({id:randomUUID(),type:'text' as const,title:'Texte',text:'ع'.repeat(2500)}));home.ar.sections=structuredClone(home.fr.sections);assert.equal(homeContent.safeParse(home).success,false);
});
test('home mutations require an expected integer version and strict action shape',()=>{
 assert.equal(changeHomeInput.safeParse({action:'save',version:0,content:initialHomeContent()}).success,true);
 for(const input of [{action:'publish'},{action:'restore',version:-1},{action:'unpublish',version:1.5},{action:'publish',version:1,content:initialHomeContent()},{action:'delete',version:1}])assert.equal(changeHomeInput.safeParse(input).success,false);
});
