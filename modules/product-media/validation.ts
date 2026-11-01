import {HttpError} from '../auth/http';
import {inspectMerchantImage} from '../media/validation';

export const PHOTO_MAX_BYTES=400*1024;
export const LIBRARY_LIMIT=30;
export const productPhotoPattern=/^\/api\/media\/products\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export const productPhotoUrl=(id:string)=>'/api/media/products/'+id;
export const productPhotoId=(url:string)=>productPhotoPattern.exec(url)?.[1]||null;

export function validateProductPhoto(bytes:Uint8Array,mimeType:string){
 if(bytes.byteLength>PHOTO_MAX_BYTES)throw new HttpError(413,'Photo trop volumineuse : maximum 400 Ko après compression');
 const info=inspectMerchantImage(bytes,mimeType,'logo');
 if(info.width>2400||info.height>2400||info.width*info.height>4_000_000)
  throw new HttpError(422,'Photo trop grande : 2400 px et 4 mégapixels maximum');
 return info;
}

export async function readProductPhoto(req:Request){
 const length=Number(req.headers.get('content-length')||0);
 if(!Number.isSafeInteger(length)||length<0||length>PHOTO_MAX_BYTES)
  throw new HttpError(413,'Photo trop volumineuse');
 const reader=req.body?.getReader();
 if(!reader)throw new HttpError(400,'Photo manquante');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>PHOTO_MAX_BYTES){await reader.cancel();throw new HttpError(413,'Photo trop volumineuse');}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=Buffer.concat(chunks);
 const mimeType=(req.headers.get('content-type')||'').split(';')[0].trim();
 return {bytes,details:validateProductPhoto(bytes,mimeType)};
}
