import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpError} from '../modules/auth/http';
import {PHOTO_MAX_BYTES,LIBRARY_LIMIT,validateProductPhoto,productPhotoUrl,productPhotoId,readProductPhoto} from '../modules/product-media/validation';
import {productImageUrl,imageUrl} from '../modules/platform/media';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOoqL8cAAAAASUVORK5CYII=','base64');
const id='c2b54418-e2b5-4821-bff3-426f5747ff12';

test('Valid product PNG is accepted with strict upper limits',()=>{
 assert.equal(LIBRARY_LIMIT,30);
 const info=validateProductPhoto(png,'image/png');
 assert.equal(info.width,1);
 assert.equal(info.height,1);
 assert.equal(info.mimeType,'image/png');
 assert.throws(()=>validateProductPhoto(Buffer.from('<svg onload="alert(1)"/>'),'image/svg+xml'),HttpError);
 assert.throws(()=>validateProductPhoto(Buffer.from('GIF89a'),'image/png'),HttpError);
 assert.throws(()=>validateProductPhoto(Buffer.alloc(PHOTO_MAX_BYTES+1),'image/png'),HttpError);
 const huge=Buffer.from(png);huge.writeUInt32BE(5000,16);
 assert.throws(()=>validateProductPhoto(huge,'image/png'),HttpError);
});

test('Only exact UUID product photo URLs and HTTPS image URLs can be saved',()=>{
 const path=productPhotoUrl(id);
 assert.equal(productPhotoId(path),id);
 assert.equal(productPhotoId(path+'?x=1'),null);
 assert.equal(productImageUrl.parse(path),path);
 assert.equal(productImageUrl.parse('https://example.test/a.png'),'https://example.test/a.png');
 assert.equal(imageUrl.safeParse(path).success,false,'Unrelated shop-brand settings remain strict');
 for(const url of [
  '//evil.test/path','/api/media/products/../../admin',
  'javascript:alert(1)','data:image/png;base64,AA','http://insecure.test/a.png'
 ])assert.equal(productImageUrl.safeParse(url).success,false);
});

test('Streaming photo reader verifies Content-Length and actual payload size',async()=>{
 const input=new Request('https://store.test/upload',{
  method:'PUT',headers:{'content-type':'image/png'},body:new Blob([new Uint8Array(png)])
 });
 const good=await readProductPhoto(input);
 assert.equal(good.details.width,1);
 assert.equal(good.bytes.byteLength,png.byteLength);
 const tooLarge=new Request('https://store.test/upload',{
  method:'PUT',headers:{'content-type':'image/png','content-length':String(PHOTO_MAX_BYTES+1)},body:new Blob([new Uint8Array(png)])
 });
 await assert.rejects(readProductPhoto(tooLarge),HttpError);
});
