import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {requireOwnCommerceWorkspace} from '../../../../modules/auth/own-commerce';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {merchantOnboardingAction} from '../../../../modules/onboarding/validation';
import {getMerchantOnboarding,updateMerchantOnboarding} from '../../../../modules/onboarding/service';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const user=await requireOwnCommerceWorkspace();
  return respond({onboarding:await getMerchantOnboarding(user.userId)});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Boutique indisponible'},503);
 }
}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const user=await requireOwnCommerceWorkspace();
  const input=merchantOnboardingAction.parse(await readJson(req,10000));
  const result=await updateMerchantOnboarding(user.userId,input);
  return respond(result);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Informations invalides'},400);
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')
   return respond({error:'Ce lien de boutique est déjà utilisé'},409);
  return respond({error:'Enregistrement indisponible'},503);
 }
}
