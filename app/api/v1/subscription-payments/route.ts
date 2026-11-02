import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {requireOwnCommerceWorkspace} from '../../../../modules/auth/own-commerce';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {consumeAttempt} from '../../../../modules/auth/service';
import {prisma} from '../../../../modules/storage/client';
import {subscriptionRequestInput} from '../../../../modules/billing/validation';
import {listMySubscriptionRequests,submitSubscriptionRequest} from '../../../../modules/billing/service';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const user=await requireOwnCommerceWorkspace();
  const [payments,plans]=await Promise.all([
   listMySubscriptionRequests(user.userId),
   prisma.subscriptionPlan.findMany({
    where:{enabled:true,priceMillimes:{gt:0}},
    select:{code:true,name:true,description:true,priceMillimes:true,durationDays:true},
    orderBy:{code:'asc'}
   })
  ]);
  return respond({payments,plans});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Paiements temporairement indisponibles'},503);
 }
}
export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const user=await requireOwnCommerceWorkspace();
  await consumeAttempt('saas-payment:'+user.userId,40);
  const data=subscriptionRequestInput.parse(await readJson(req,10000));
  const result=await submitSubscriptionRequest(user.userId,data);
  return respond(result,result.alreadySubmitted?200:201);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Déclaration invalide'},400);
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')
   return respond({error:'Une déclaration identique ou en attente existe déjà'},409);
  return respond({error:'Déclaration temporairement indisponible'},503);
 }
}
