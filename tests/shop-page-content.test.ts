import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pageContent,createPageInput,changePageInput,initialPageContent} from '../modules/shops/page-content';
test('Page content bounds sections and accepts French and Arabic plain text',()=>{
 const content=initialPageContent('قصتنا');content.language='ar';
 assert.ok(pageContent.safeParse(content).success);
 assert.equal(pageContent.safeParse({...content,sections:[]}).success,false);
 assert.equal(pageContent.safeParse({...content,sections:[content.sections[0],content.sections[0]]}).success,false);
 assert.equal(pageContent.safeParse({...content,sections:Array.from({length:13},()=>({...content.sections[0],id:randomUUID()}))}).success,false);
 assert.equal(pageContent.safeParse({...content,sections:[{id:randomUUID(),type:'html',title:'Unsafe',html:'<script>alert(1)</script>'}]}).success,false);
 assert.equal(pageContent.safeParse({...content,sections:[{id:randomUUID(),type:'cta',title:'Link',text:'Link',label:'Open',url:'javascript:alert(1)'}]}).success,false);
 const large={...content,sections:Array.from({length:12},()=>({id:randomUUID(),type:'text',title:'Texte',text:'ع'.repeat(2500)}))};
 assert.equal(pageContent.safeParse(large).success,false);
});
test('Page slugs and write actions reject paths, extra authority and invalid versions',()=>{
 const content=initialPageContent();
 assert.ok(createPageInput.safeParse({slug:'a-propos',content}).success);
 for(const slug of ['../admin','hello/world','Hello','-test','test-','a','a'.repeat(61)])
  assert.equal(createPageInput.safeParse({slug,content}).success,false);
 assert.equal(createPageInput.safeParse({slug:'contact',content,ownerId:'forged'}).success,false);
 assert.ok(changePageInput.safeParse({action:'save',version:0,content}).success);
 assert.equal(changePageInput.safeParse({action:'publish',version:0,content}).success,false);
 assert.equal(changePageInput.safeParse({action:'publish',version:-1}).success,false);
});
