import {z} from 'zod';
import {requireOwnCommerceWorkspace} from '../../../../modules/auth/own-commerce';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {appearanceSchema} from '../../../../modules/appearance/validation';
import {getStoreAppearance,saveStoreAppearance} from '../../../../modules/appearance/service';

export const dynamic='force-dynamic';
export async function GET(){
 try{
  const ownerId=(await requireOwnCommerceWorkspace()).userId;
  return respond({store:await getStoreAppearance(ownerId)});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Configuration indisponible'},503);
 }
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const ownerId=(await requireOwnCommerceWorkspace()).userId;
  const input=appearanceSchema.parse(await readJson(req,14000));
  return respond(await saveStoreAppearance(ownerId,input));
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Données invalides'},400);
  return respond({error:'Enregistrement impossible'},503);
 }
}
