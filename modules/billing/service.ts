import {randomBytes} from 'node:crypto';
import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import type {SubscriptionDecisionInput,SubscriptionRequestInput} from './validation';
import {assertReceptionEnabled} from './reception';
import {subscriptionDecisionInput} from './validation';
import {subscriptionRenewalPeriod} from './renewal';

function normalizedReference(input:SubscriptionRequestInput){
 return input.method==='CASH'?null:input.transferReference.trim().replace(/\s+/g,' ').toUpperCase();
}

/** A payment declaration is NOT proof of receipt. Never change the merchant plan here. */
export async function submitSubscriptionRequest(ownerId:string,input:SubscriptionRequestInput){
 return prisma.$transaction(async tx=>{
  const workspace=await tx.workspace.findUnique({
   where:{ownerId},select:{id:true}
  });
  if(!workspace)throw new HttpError(404,'Aucune boutique personnelle associée au compte');
  // Serialize claims for a single workspace. DB also has a partial unique PENDING index.
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspace.id} FOR UPDATE`;
  const transferReference=normalizedReference(input);
  const previous=await tx.subscriptionPayment.findUnique({
   where:{workspaceId_requestId:{workspaceId:workspace.id,requestId:input.requestId}}
  });
  if(previous){
   if(previous.planCode!==input.planCode||previous.method!==input.method||
      previous.transferReference!==transferReference||previous.merchantNote!==input.merchantNote)
    throw new HttpError(409,'Cette référence de demande est déjà utilisée avec des informations différentes');
   return {payment:previous,alreadySubmitted:true};
  }
  const pending=await tx.subscriptionPayment.findFirst({
   where:{workspaceId:workspace.id,status:'PENDING'},select:{id:true,reference:true}
  });
  if(pending)throw new HttpError(409,'Une demande est déjà en attente de vérification. Consultez son statut avant de déposer une nouvelle demande.');

  await assertReceptionEnabled(input.method,tx);
  const plan=await tx.subscriptionPlan.findUnique({
   where:{code:input.planCode},
   select:{code:true,name:true,enabled:true,priceMillimes:true,durationDays:true}
  });
  if(!plan||!plan.enabled)throw new HttpError(409,'Cette offre n’est plus disponible');
  if(plan.priceMillimes<=0)
   throw new HttpError(409,'Cette offre ne dispose pas encore de tarif. Contactez TuniCommerce pour une attribution manuelle.');

  const payment=await tx.subscriptionPayment.create({
   data:{
    reference:'TC-AB-'+new Date().getUTCFullYear()+'-'+randomBytes(9).toString('hex').toUpperCase(),
    workspaceId:workspace.id,requestId:input.requestId,requesterId:ownerId,
    planCode:plan.code,planName:plan.name,
    priceMillimes:plan.priceMillimes,durationDays:plan.durationDays,
    method:input.method,transferReference,
    merchantNote:input.merchantNote,status:'PENDING'
   }
  });
  return {payment,alreadySubmitted:false};
 });
}

export async function listMySubscriptionRequests(ownerId:string){
 const workspace=await prisma.workspace.findUnique({
  where:{ownerId},select:{id:true}
 });
 if(!workspace)throw new HttpError(404,'Boutique personnelle introuvable');
 return prisma.subscriptionPayment.findMany({
  where:{workspaceId:workspace.id},orderBy:{createdAt:'desc'},take:60
 });
}

export async function decideSubscriptionRequest(actorId:string,input:SubscriptionDecisionInput){
 input=subscriptionDecisionInput.parse(input);
 const initial=await prisma.subscriptionPayment.findUnique({
  where:{id:input.id},select:{workspaceId:true}
 });
 if(!initial)throw new HttpError(404,'Demande de paiement introuvable');

 return prisma.$transaction(async tx=>{
  // Lock workspace before both approval AND rejection so two admins cannot race,
  // and a claim creation cannot race a decision.
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${initial.workspaceId} FOR UPDATE`;
  const payment=await tx.subscriptionPayment.findUniqueOrThrow({where:{id:input.id}});
  if(payment.status!=='PENDING'){
   if(payment.status==='APPROVED'&&input.action==='approve')
    return {payment,alreadyDecided:true};
   if(payment.status==='REJECTED'&&input.action==='reject')
    return {payment,alreadyDecided:true};
   throw new HttpError(409,'Demande déjà traitée avec une autre décision');
  }
  const workspace=await tx.workspace.findUniqueOrThrow({
   where:{id:initial.workspaceId},select:{id:true,plan:true,subscriptionStatus:true,subscriptionEndsAt:true}
  });
  const now=new Date();
  const nextStatus=input.action==='approve'?'APPROVED':'REJECTED';
  const period=input.action==='approve'?subscriptionRenewalPeriod(workspace,payment.durationDays,now):null;
  const startAt=period?.startAt||null,endsAt=period?.endsAt||null;

  const saved=await tx.subscriptionPayment.updateMany({
   where:{id:payment.id,status:'PENDING'},
   data:{
    status:nextStatus,adminNote:input.adminNote,
    decidedById:actorId,decidedAt:now,
    periodStartsAt:startAt,periodEndsAt:endsAt
   }
  });
  if(saved.count!==1)throw new HttpError(409,'Demande traitée simultanément');
  if(input.action==='approve'){
   // No external payment API is invoked. Only ADMIN approval activates the plan.
   await tx.workspace.update({
    where:{id:workspace.id},
    data:{plan:payment.planCode,subscriptionStatus:'ACTIVE',subscriptionEndsAt:endsAt!}
   });
  }
  await tx.platformAudit.create({data:{
   actorId,workspaceId:workspace.id,
   detail:JSON.stringify({
    action:'subscription_payment_'+nextStatus.toLowerCase(),
    requestId:payment.id,reference:payment.reference,
    plan:payment.planCode,amountMillimes:payment.priceMillimes,
    durationDays:payment.durationDays,method:payment.method,
    receivedConfirmed:input.action==='approve',
    previousPlan:workspace.plan,previousStatus:workspace.subscriptionStatus,
    previousEndsAt:workspace.subscriptionEndsAt?.toISOString()||null,
    periodStartsAt:startAt?.toISOString()||null,
    periodEndsAt:endsAt?.toISOString()||null
   })
  }});
  const updated=await tx.subscriptionPayment.findUniqueOrThrow({where:{id:payment.id}});
  return {payment:updated,alreadyDecided:false};
 },{timeout:12000});
}
