import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceSchema} from '../modules/appearance/validation';
import {getInternalMediaId,inspectMerchantImage,mediaPath,readBoundedMedia} from '../modules/media/validation';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
const uuid='c2b54418-e2b5-4821-bff3-426f5747ff12';

test('Real one-pixel PNG is accepted and dimensions are obtained from image signature',()=>{
 const info=inspectMerchantImage(png,'image/png','logo');
 assert.deepEqual(info,{mimeType:'image/png',size:png.length,width:1,height:1});
 assert.throws(()=>inspectMerchantImage(Buffer.from('<svg/>'),'image/png','logo'));
 assert.throws(()=>inspectMerchantImage(png,'image/svg+xml','logo'));
 assert.throws(()=>inspectMerchantImage(Buffer.alloc(700*1024+1),'image/png','logo'));
 const huge=Buffer.from(png);huge.writeUInt32BE(6001,16);
 assert.throws(()=>inspectMerchantImage(huge,'image/png','banner'));
});

test('WebP/JPEG malformed files cannot bypass format verification',()=>{
 assert.throws(()=>inspectMerchantImage(Buffer.from([0xff,0xd8,0xff,0xe0]),'image/jpeg','logo'));
 assert.throws(()=>inspectMerchantImage(Buffer.from('RIFFxxxxxxxxWEBPbad!'),'image/webp','logo'));
 assert.throws(()=>inspectMerchantImage(Buffer.from('GIF89a'),'image/gif','logo'));
});

test('Exact UUID media paths are allowed, but relative traversal and data URIs are not',()=>{
 const url='/api/media/assets/'+uuid;
 assert.equal(mediaPath.test(url),true);
 assert.equal(getInternalMediaId(url),uuid);
 assert.equal(getInternalMediaId('https://example.com/foo.png'),null);
 const input={
  theme:'classic',accent:'#21815F',eyebrow:'Bienvenue',tagline:'Livraison Tunisie',
  description:'',logoUrl:url,bannerUrl:'https://static.example.test/banner.png'
 };
 assert.deepEqual(appearanceSchema.parse(input),input);
 for(const bad of ['//another-site/img','/api/media/assets/../../admin','javascript:alert(1)','data:image/png;base64,AAA','http://example.test/image.jpg'])
  assert.throws(()=>appearanceSchema.parse({...input,logoUrl:bad}));
});

test('Streaming reader rejects missing payload and excessive content length before parsing',async()=>{
 const empty=new Request('https://app.test/upload',{method:'PUT',headers:{'content-type':'image/png'}});
 await assert.rejects(readBoundedMedia(empty,'logo'));
 const tooLarge=new Request('https://app.test/upload',{
  method:'PUT',headers:{'content-type':'image/png','content-length':String(700*1024+1)},
  body:new Blob([png])
 });
 await assert.rejects(readBoundedMedia(tooLarge,'logo'));
 const good=new Request('https://app.test/upload',{
  method:'PUT',headers:{'content-type':'image/png'},body:new Blob([png])
 });
 const uploaded=await readBoundedMedia(good,'logo');
 assert.equal(uploaded.details.width,1);
 assert.equal(uploaded.bytes.byteLength,png.byteLength);
});
