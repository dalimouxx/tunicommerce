import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../components/storefront-motion.module.css',import.meta.url),'utf8');
const rules=(source:string)=>[...source.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match=>({selector:match[1].trim(),body:match[2]}));

test('shared motion layer honours reduced motion and the pause control',()=>{
 assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
 assert.match(css,/\[data-motion="paused"\]/);
});
test('content is only hidden once the reveal script has run',()=>{
 assert.match(css,/\[data-reveal-ready\][^{]*\[data-reveal\]/);
 for(const rule of rules(css))if(/opacity:\s*0(?![.\d])/.test(rule.body)&&!/@keyframes|^(from|to|\d+%)$/.test(rule.selector))
  assert.match(rule.selector,/\[data-reveal-ready\]/,rule.selector);
});
test('offer badges are hidden by default and only themes reveal them',()=>{
 assert.match(css,/\[data-part="offer-badge"\][^{]*\{[^}]*display:\s*none/);
});

const themeFiles=['medina','sahara','bento','souk','aurora','magazine'];
const themeCss=(name:string)=>readFileSync(new URL('../components/storefront-themes/'+name+'.module.css',import.meta.url),'utf8');
test('each new theme ships a self-contained module that respects reduced motion',()=>{
 for(const name of themeFiles){
  const source=themeCss(name);
  assert.match(source,/^\.root\b|\n\.root\b/m,name);
  assert.match(source,/@media\s*\(prefers-reduced-motion:\s*reduce\)/,name);
  assert.ok(!/url\(\s*['"]?https?:/.test(source),name+' loads a remote asset');
  assert.ok(!/display:\s*none/.test(source.split(':global(.checkout)').slice(1).join('')),name+' hides checkout content');
 }
});
test('aurora keeps cards readable without backdrop-filter and souk mirrors its marquee in RTL',()=>{
 assert.match(themeCss('aurora'),/@supports not \(backdrop-filter/);
 assert.match(themeCss('souk'),/\[dir="rtl"\]/);
 assert.match(themeCss('souk'),/\[data-part="offer-badge"\][^{]*\{[^}]*display:\s*(inline-)?(block|flex|inline-flex)/);
});
test('themeClass maps every new theme to its own module and nothing else',()=>{
 const index=readFileSync(new URL('../components/storefront-themes/index.ts',import.meta.url),'utf8');
 for(const name of themeFiles){
  assert.match(index,new RegExp("import "+name+" from './"+name+".module.css'"),name);
  assert.match(index,new RegExp(name.toUpperCase()+':'+name+'\\.root'),name);
 }
 assert.equal((index.match(/\.root/g)||[]).length,themeFiles.length);
});
test('aurora keeps light panels of independent shops readable with dark text',()=>{
 assert.match(themeCss('aurora'),/:global\(\.checkout\)[^{]*\{[^}]*color:\s*#1b1830/);
 assert.match(themeCss('aurora'),/:global\(\.notice\)[^{]*\{[^}]*color:\s*#1b1830/);
});
test('sticky header is limited to wide screens so it never eats a phone viewport',()=>{
 const outside=css.replace(/@media\s*\(min-width:\s*7\d\dpx\)\s*\{[\s\S]*?\n\}/g,'');
 assert.ok(!/position:\s*sticky/.test(outside),'sticky header outside a min-width media query');
 assert.match(css,/@media\s*\(min-width:\s*7\d\dpx\)\s*\{[\s\S]*?position:\s*sticky/);
});
