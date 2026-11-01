/** Browser-only: normalize merchant photos before transfer to reduce storage and bandwidth. */
const MAX_SOURCE_BYTES=12*1024*1024;
const MAX_OUTPUT_BYTES=400*1024;

function toBlob(canvas:HTMLCanvasElement,mime:string,quality:number){
 return new Promise<Blob>((resolve,reject)=>{
  canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Compression impossible sur cet appareil')),mime,quality);
 });
}

async function loadPhoto(file:File):Promise<{source:CanvasImageSource;width:number;height:number;close:()=>void}>{
 if(typeof createImageBitmap==='function'){
  const image=await createImageBitmap(file,{imageOrientation:'from-image'});
  return {source:image,width:image.width,height:image.height,close:()=>image.close()};
 }
 const objectURL=URL.createObjectURL(file);
 const image=new Image();
 try{
  image.src=objectURL;
  await image.decode();
  return {source:image,width:image.naturalWidth,height:image.naturalHeight,close:()=>URL.revokeObjectURL(objectURL)};
 }catch(e){URL.revokeObjectURL(objectURL);throw e;}
}

export async function compressProductPhoto(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))
  throw new Error('Format non accepté. Choisissez un JPG, PNG ou WebP.');
 if(file.size===0||file.size>MAX_SOURCE_BYTES)
  throw new Error('Fichier trop volumineux. Maximum 12 Mo avant compression.');
 let picture:Awaited<ReturnType<typeof loadPhoto>>;
 try{picture=await loadPhoto(file);}
 catch{throw new Error('Impossible de lire cette image. Essayez une autre photo.');}
 try{
  if(!picture.width||!picture.height||picture.width*picture.height>60_000_000)
   throw new Error('Dimensions de la photo trop grandes.');
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d',{alpha:false});
  if(!context)throw new Error('Compression indisponible sur cet appareil');
  let scale=Math.min(1,1600/Math.max(picture.width,picture.height));
  let quality=.86;
  for(let pass=0;pass<9;pass++){
   canvas.width=Math.max(1,Math.round(picture.width*scale));
   canvas.height=Math.max(1,Math.round(picture.height*scale));
   context.fillStyle='#ffffff';
   context.fillRect(0,0,canvas.width,canvas.height);
   context.drawImage(picture.source,0,0,canvas.width,canvas.height);
   let output=await toBlob(canvas,'image/webp',quality);
   // Older browsers may silently substitute PNG when WebP is not available.
   if(output.type!=='image/webp')output=await toBlob(canvas,'image/jpeg',quality);
   if(output.size<=MAX_OUTPUT_BYTES&&output.size>0)return output;
   scale*=.78;
   quality=Math.max(.52,quality-.07);
  }
  throw new Error('Image trop complexe à compresser. Choisissez une photo plus légère.');
 }finally{picture.close();}
}
