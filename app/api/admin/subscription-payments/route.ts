import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {subscriptionDecisionInput} from '../../../../modules/billing/validation';
import {decideSubscriptionRequest} from '../../../../modules/billing/service';
import {prisma} from '../../../../modules/storage/client';
import {PAYMENT_PAGE_SIZE,paymentDirectoryPage,paymentDirectoryQuery} from '../../../../modules/billing/payment-directory';

export const dynamic='force-dynamic';

export async function GET(request:Request){
 try{
  await requireAdmin();
  const query=paymentDirectoryQuery(Object.fromEntries(new URL(request.url).searchParams));
  const total=await prisma.subscriptionPayment.count({where:query.where});
  const paging=paymentDirectoryPage(query.page,total);
  const payments=await prisma.subscriptionPayment.findMany({
   where:query.where,orderBy:[{createdAt:'asc'},{id:'asc'}],
   skip:(paging.page-1)*PAYMENT_PAGE_SIZE,take:PAYMENT_PAGE_SIZE,
   include:{workspace:{select:{slug:true,owner:{select:{name:true,email:true}}}}}
  });
  return respond({payments,total,page:paging.page,pages:paging.pages,pageSize:PAYMENT_PAGE_SIZE});
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  return respond({error:'Dossiers indisponibles'},503);
 }
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);
  const actor=await requireAdmin();
  const data=subscriptionDecisionInput.parse(await readJson(req,10000));
  const result=await decideSubscriptionRequest(actor.userId,data);
  return respond(result);
 }catch(e){
  if(e instanceof HttpError)return respond({error:e.message},e.status);
  if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message||'Décision invalide'},400);
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')
   return respond({error:'Cette référence D17 ou bancaire a déjà été validée pour une autre demande.'},409);
  return respond({error:'Validation indisponible, aucune confirmation enregistrée'},503);
 }
}
