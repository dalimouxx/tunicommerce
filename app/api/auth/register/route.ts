import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {merchantRegistration} from '../../../../modules/onboarding/validation';
import {createMerchantAccount} from '../../../../modules/onboarding/service';
import {createSession} from '../../../../modules/auth/session';

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const input=merchantRegistration.parse(await readJson(req,8000));
  const result=await createMerchantAccount(input);
  await createSession(result.userId);
  return respond({ok:true,shopSlug:result.slug,next:'/demarrage'},201);
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  if(error instanceof z.ZodError)return respond({error:error.issues[0]?.message||'Données invalides'},400);
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')
   return respond({error:'Adresse e-mail ou lien de boutique déjà utilisé'},409);
  return respond({error:'Inscription indisponible actuellement'},503);
 }
}
