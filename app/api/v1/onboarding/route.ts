import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {getCurrentUser} from '../../../../modules/auth/session';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {merchantOnboardingAction} from '../../../../modules/onboarding/validation';
import {getMerchantOnboarding,updateMerchantOnboarding} from '../../../../modules/onboarding/service';

export const dynamic='force-dynamic';

async function requireMerchant(){
 const user=await getCurrentUser();
 if(!user)throw new HttpError(401,'Connexion requise');
 if(user.role!=='MERCHANT')throw new HttpError(403,'Espace réservé aux marchands');
 return user;
}
export async function GET(){
 try{
  const user=await requireMerchant();
  return respond({onboarding:await getMerchantOnboarding(user.userId)});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Boutique indisponible'},503);
 }
}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const user=await requireMerchant();
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
