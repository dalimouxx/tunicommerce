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
