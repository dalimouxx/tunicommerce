import {z} from 'zod';
import {getCurrentUser} from '../../../../../modules/auth/session';
import {assertSameOrigin,respond,HttpError} from '../../../../../modules/auth/http';
import {removeProductPhoto} from '../../../../../modules/product-media/service';
export const dynamic='force-dynamic';

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  assertSameOrigin(req);
  const user=await getCurrentUser();
  if(!user)throw new HttpError(401,'Connexion requise');
  if(user.role!=='MERCHANT')throw new HttpError(403,'Réservé au propriétaire');
  const {id}=await params;
  if(!z.string().uuid().safeParse(id).success)throw new HttpError(404,'Photo introuvable');
  return respond(await removeProductPhoto(user.userId,id));
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Suppression indisponible'},503);
 }
}
