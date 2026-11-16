import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {prisma} from '../storage/client';
import {HttpError,applicationOrigin} from '../auth/http';
import {consumeAttempt} from '../auth/service';
import {normalizeState} from '../commerce/normalize';
import {applyAction} from '../commerce/service';
import type {State} from '../commerce/types';
import {writeIsolatedCommerce} from './aggregate-quotas';
import {storefrontAddress} from './storefront-address-service';
import {tunisianWhatsAppUrl} from './manual-messaging';
import {confirmationMessage,confirmationTokenPattern,confirmationView,type ConfirmationAnswer} from './order-confirmation';

async function isolatedShop(slug:string){
 if(!slug||slug.length>180)return null;
 const shop=await prisma.shop.findUnique({where:{slug},select:{id:true,name:true,legacyWorkspaceId:true,organization:{select:{ownerId:true}},commerce:{select:{data:true}}}});
 return shop&&shop.legacyWorkspaceId===null&&shop.commerce?shop:null;
}
/** Public page data. A bearer link only: anyone holding it sees the order content, like the tracking link. */
export async function publicConfirmation(slug:string,token:string){
 if(!confirmationTokenPattern.test(token))return null;
 const shop=await isolatedShop(slug);
 if(!shop)return null;
 const state=normalizeState(shop.commerce!.data as unknown as State);
 const view=confirmationView(state,token,new Date());
 return view?{...view,shopName:state.shop.name||shop.name}:null;
}
/** Customer answer, written with the same lock, version check and throttling as customer requests. */
export async function submitCustomerConfirmation(slug:string,token:string,input:{answer:ConfirmationAnswer;note?:string}){
 if(!confirmationTokenPattern.test(token))throw new HttpError(404,'Lien de confirmation introuvable');
 const shop=await isolatedShop(slug);
 if(!shop)throw new HttpError(404,'Lien de confirmation introuvable');
 const ownerId=shop.organization.ownerId;
 await consumeAttempt('order-confirmation:'+createHash('sha256').update(shop.id+':'+token).digest('hex'),20);
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${ownerId}))`;
  const current=await tx.shop.findUnique({where:{id:shop.id},select:{legacyWorkspaceId:true,organization:{select:{ownerId:true}},commerce:{select:{data:true,version:true}}}});
  if(!current||current.legacyWorkspaceId!==null||current.organization.ownerId!==ownerId||!current.commerce)throw new HttpError(404,'Lien de confirmation introuvable');
  const state=normalizeState(current.commerce.data as unknown as State);
  const order=state.orders.find(item=>item.confirmation?.token===token);
  if(!order)throw new HttpError(404,'Lien de confirmation introuvable');
  // A double click with the same answer is a retry, not a second answer.
  if(order.confirmation?.answer===input.answer)return {answer:input.answer,alreadyApplied:true};
  let next:State;
  try{next=applyAction(state,'customerConfirmation',{token,answer:input.answer,...(input.note?{note:input.note}:{})});}
  catch(error){throw new HttpError(409,error instanceof Error?error.message:'Réponse impossible');}
  const saved=await tx.shopCommerce.updateMany({where:{shopId:shop.id,version:current.commerce.version},data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}});
  if(saved.count!==1)throw new HttpError(409,'Modification concurrente, réessayez');
  return {answer:input.answer,alreadyApplied:false};
 },{timeout:15000});
}
/** Merchant or call-center agent: prepares the link and the WhatsApp message for the order's phone. */
export async function prepareConfirmationLink(userId:string,shopId:string,orderId:string){
 const result=await writeIsolatedCommerce(userId,shopId,{action:'issueConfirmationLink',requestId:crypto.randomUUID(),payload:{orderId}},()=>{},'orders.update');
 const order=result.state.orders.find(item=>item.id===orderId);
 if(!order?.confirmation)throw new HttpError(409,'Lien de confirmation indisponible');
 const shop=await prisma.shop.findUnique({where:{id:shopId},select:{id:true,slug:true,name:true,organization:{select:{ownerId:true}}}});
 if(!shop)throw new HttpError(404,'Boutique introuvable');
 const address=await storefrontAddress({id:shop.id,slug:shop.slug,ownerId:shop.organization.ownerId},'/vitrines/'+encodeURIComponent(shop.slug));
 const base=address.startsWith('https://')?address:applicationOrigin().replace(/\/$/,'')+address;
 const link=base.replace(/\/$/,'')+'/confirmer/'+order.confirmation.token;
 const customer=order.customerSnapshot||result.state.customers.find(item=>item.id===order.customerId);
 const message=confirmationMessage(order,link,result.state.shop.name||shop.name);
 return {link,message,whatsappUrl:customer?tunisianWhatsAppUrl(customer.phone,message):null,expiresAt:order.confirmation.expiresAt};
}
