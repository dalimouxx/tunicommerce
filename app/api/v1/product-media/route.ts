import {getCurrentUser} from '../../../../modules/auth/session';
import {assertSameOrigin,respond,HttpError} from '../../../../modules/auth/http';
import {consumeAttempt} from '../../../../modules/auth/service';
import {readProductPhoto} from '../../../../modules/product-media/validation';
import {listProductPhotos,uploadProductPhoto} from '../../../../modules/product-media/service';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function ownerId(){
 const user=await getCurrentUser();
 if(!user)throw new HttpError(401,'Connexion requise');
 if(user.role!=='MERCHANT')throw new HttpError(403,'Réservé au propriétaire de boutique');
 return user.userId;
}
function onError(e:unknown){
 if(e instanceof HttpError)return respond({error:e.message},e.status);
 return respond({error:'Médiathèque temporairement indisponible'},503);
}
export async function GET(){
 try{return respond(await listProductPhotos(await ownerId()));}
 catch(e){return onError(e);}
}
export async function PUT(req:Request){
 try{
  assertSameOrigin(req);
  const owner=await ownerId();
  await consumeAttempt('product-photo:'+owner,50);
  const {bytes,details}=await readProductPhoto(req);
  return respond(await uploadProductPhoto(owner,bytes,details),201);
 }catch(e){return onError(e);}
}
