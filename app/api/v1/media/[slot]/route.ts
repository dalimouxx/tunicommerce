import {z} from 'zod';
import {requireOwnCommerceWorkspace} from '../../../../../modules/auth/own-commerce';
import {assertSameOrigin,respond,HttpError} from '../../../../../modules/auth/http';
import {consumeAttempt} from '../../../../../modules/auth/service';
import {mediaSlots,readBoundedMedia} from '../../../../../modules/media/validation';
import {saveMerchantMedia} from '../../../../../modules/media/service';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function PUT(req:Request,{params}:{params:Promise<{slot:string}>}){
 try{
  assertSameOrigin(req);
  const user=await requireOwnCommerceWorkspace();
  const {slot:input}=await params;
  const slot=z.enum(mediaSlots).parse(input);
  await consumeAttempt('media-upload:'+user.userId,30);
  const {bytes,details}=await readBoundedMedia(req,slot);
  return respond(await saveMerchantMedia(user.userId,slot,bytes,details),201);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:'Type d’image invalide'},400);
  return respond({error:'Importation indisponible'},503);
 }
}
