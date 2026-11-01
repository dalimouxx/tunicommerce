import {z} from 'zod';
import {getCurrentUser} from '../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {appearanceSchema} from '../../../../modules/appearance/validation';
import {getStoreAppearance,saveStoreAppearance} from '../../../../modules/appearance/service';

export const dynamic='force-dynamic';
async function merchantId(){
 const user=await getCurrentUser();
 if(!user)throw new HttpError(401,'Connexion requise');
 if(user.role!=='MERCHANT')throw new HttpError(403,'Cette page est réservée au propriétaire de la boutique');
 return user.userId;
}

export async function GET(){
 try{
  const ownerId=await merchantId();
  return respond({store:await getStoreAppearance(ownerId)});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Configuration indisponible'},503);
 }
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const ownerId=await merchantId();
  const input=appearanceSchema.parse(await readJson(req,14000));
  return respond(await saveStoreAppearance(ownerId,input));
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Données invalides'},400);
  return respond({error:'Enregistrement impossible'},503);
 }
}
