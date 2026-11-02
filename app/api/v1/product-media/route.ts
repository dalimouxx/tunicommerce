import {requireOwnCommerceWorkspace} from '../../../../modules/auth/own-commerce';
import {assertSameOrigin,respond,HttpError} from '../../../../modules/auth/http';
import {consumeAttempt} from '../../../../modules/auth/service';
import {readProductPhoto} from '../../../../modules/product-media/validation';
import {listProductPhotos,uploadProductPhoto} from '../../../../modules/product-media/service';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function onError(e:unknown){
 if(e instanceof HttpError)return respond({error:e.message},e.status);
 return respond({error:'Médiathèque temporairement indisponible'},503);
}
export async function GET(){
 try{return respond(await listProductPhotos((await requireOwnCommerceWorkspace()).userId));}
 catch(e){return onError(e);}
}
export async function PUT(req:Request){
 try{
  assertSameOrigin(req);
  const owner=(await requireOwnCommerceWorkspace()).userId;
  await consumeAttempt('product-photo:'+owner,50);
  const {bytes,details}=await readProductPhoto(req);
  return respond(await uploadProductPhoto(owner,bytes,details),201);
 }catch(e){return onError(e);}
}
