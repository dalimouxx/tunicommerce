import {HttpError} from '../auth/http';

export type MediaSlot='logo'|'banner';
export const mediaSlots=['logo','banner'] as const;
export const maxMediaBytes:Record<MediaSlot,number>={
 logo:700*1024,
 banner:2*1024*1024
};
export const mediaPath=/^\/api\/media\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export function getInternalMediaId(value:string){
 return mediaPath.exec(value)?.[1]||null;
}

function read32(source:Uint8Array,offset:number){
 return (source[offset]*0x1000000)+(source[offset+1]<<16)+(source[offset+2]<<8)+source[offset+3];
}
function read16(source:Uint8Array,offset:number){
 return source[offset]*256+source[offset+1];
}
function code(source:Uint8Array,start:number,count:number){
 return String.fromCharCode(...source.slice(start,start+count));
}

function inspectPNG(b:Uint8Array){
 if(b.length<33||code(b,0,8)!=='\x89PNG\r\n\x1a\n'||code(b,12,4)!=='IHDR'||read32(b,8)!==13)
  throw new HttpError(415,'Fichier PNG invalide');
 return {width:read32(b,16),height:read32(b,20)};
}

function inspectJPEG(b:Uint8Array){
 if(b.length<12||b[0]!==0xff||b[1]!==0xd8)throw new HttpError(415,'Fichier JPEG invalide');
 let position=2;
 for(;position<b.length-3;){
  if(b[position]!==0xff)break;
  while(b[position]===0xff)position++;
  const marker=b[position++];
  if(marker===0xd9||marker===0xda)break;
  if(marker>=0xd0&&marker<=0xd7||marker===0x01)continue;
  if(position+2>b.length)break;
  const length=read16(b,position);
  if(length<2||position+length>b.length)break;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   if(length<7)break;
   return {width:read16(b,position+5),height:read16(b,position+3)};
  }
  position+=length;
 }
 throw new HttpError(415,'Dimensions JPEG introuvables');
}

function inspectWEBP(b:Uint8Array){
 if(b.length<30||code(b,0,4)!=='RIFF'||code(b,8,4)!=='WEBP')
  throw new HttpError(415,'Fichier WebP invalide');
 const format=code(b,12,4);
 if(format==='VP8X')return {
  width:1+b[24]+(b[25]<<8)+(b[26]<<16),
  height:1+b[27]+(b[28]<<8)+(b[29]<<16)
 };
 if(format==='VP8L'){
  if(b[20]!==0x2f)throw new HttpError(415,'Fichier WebP invalide');
  return {
   width:1+(b[21]|((b[22]&0x3f)<<8)),
   height:1+((b[22]>>6)|(b[23]<<2)|((b[24]&0x0f)<<10))
  };
 }
 if(format==='VP8 '){
  if(b.length<30||b[23]!==0x9d||b[24]!==0x01||b[25]!==0x2a)
   throw new HttpError(415,'Fichier WebP invalide');
  return {
   width:(b[26]|(b[27]<<8))&0x3fff,
   height:(b[28]|(b[29]<<8))&0x3fff
  };
 }
 throw new HttpError(415,'Format WebP non pris en charge');
}

export function inspectMerchantImage(data:Uint8Array,mime:string,slot:MediaSlot){
 const max=maxMediaBytes[slot];
 if(!data.byteLength||data.byteLength>max)
  throw new HttpError(413,`Image trop volumineuse (maximum ${Math.round(max/1024)} Ko)`);
 const dimensions=mime==='image/png'?inspectPNG(data):
  mime==='image/jpeg'?inspectJPEG(data):
  mime==='image/webp'?inspectWEBP(data):
  null;
 if(!dimensions)throw new HttpError(415,'Utilisez uniquement PNG, JPEG ou WebP');
 if(!Number.isInteger(dimensions.width)||!Number.isInteger(dimensions.height)||
  dimensions.width<1||dimensions.height<1||
  dimensions.width>6000||dimensions.height>6000||
  dimensions.width*dimensions.height>16_000_000)
  throw new HttpError(422,'Dimensions trop grandes : 6000 px et 16 mégapixels maximum');
 return {...dimensions,mimeType:mime,size:data.byteLength};
}

export async function readBoundedMedia(req:Request,slot:MediaSlot){
 const max=maxMediaBytes[slot];
 const reported=Number(req.headers.get('content-length')||'0');
 if(!Number.isSafeInteger(reported)||reported<0||reported>max)throw new HttpError(413,'Image trop volumineuse');
 const reader=req.body?.getReader();
 if(!reader)throw new HttpError(400,'Fichier manquant');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>max){
    await reader.cancel();
    throw new HttpError(413,'Image trop volumineuse');
   }
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=Buffer.concat(chunks);
 return {bytes,details:inspectMerchantImage(bytes,(req.headers.get('content-type')||'').split(';')[0].trim(),slot)};
}
