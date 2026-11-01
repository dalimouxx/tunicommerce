import {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {initialState} from '../commerce/seed';
import {applyAction} from '../commerce/service';
import {normalizeState} from '../commerce/normalize';
import type {State} from '../commerce/types';
import {hashPassword,digest} from '../auth/crypto';
import {consumeAttempt} from '../auth/service';
import {HttpError} from '../auth/http';
import {isOpen} from '../platform/public';
import type {MerchantRegistration,MerchantOnboardingAction} from './validation';

const trialDays=30;
const trialEnd=()=>new Date(Date.now()+trialDays*24*60*60*1000);

export async function createMerchantAccount(input:MerchantRegistration){
 // Durable server-side throttling protects registration without trusting forwarded IP headers.
 await consumeAttempt('signup:all',60);
 await consumeAttempt('signup:email:'+digest(input.email),5);
 const passwordHash=await hashPassword(input.password);
 const state=initialState(false);
 state.shop.name=input.shopName;
 state.shop.phone='';
 state.shop.address='';
 return prisma.$transaction(async tx=>{
  const occupied=await Promise.all([
   tx.workspace.findUnique({where:{slug:input.slug},select:{id:true}}),
   tx.shop.findUnique({where:{slug:input.slug},select:{id:true}})
  ]);
  if(occupied.some(Boolean))throw new HttpError(409,'Ce lien de boutique est déjà utilisé');
  const user=await tx.user.create({
   data:{name:input.name,email:input.email,passwordHash,role:'MERCHANT'},
   select:{id:true}
  });
  const workspace=await tx.workspace.create({
   data:{
    ownerId:user.id,slug:input.slug,
    published:false,plan:'STARTER',subscriptionStatus:'TRIAL',
    subscriptionEndsAt:trialEnd(),
    data:state as unknown as Prisma.InputJsonValue
   },
   select:{id:true}
  });
  const organization=await tx.organization.create({
   data:{ownerId:user.id,name:input.shopName},
   select:{id:true}
  });
  const shop=await tx.shop.create({
   data:{
    organizationId:organization.id,legacyWorkspaceId:workspace.id,
    name:input.shopName,slug:input.slug,status:'DRAFT',
    memberships:{create:{userId:user.id,role:'OWNER'}}
   },
   select:{id:true,slug:true}
  });
  return {userId:user.id,shopId:shop.id,slug:shop.slug};
 });
}

function readiness(state:State){
 const active=state.products.filter(p=>p.active&&p.price>0&&p.stock>0);
 const missing:string[]=[];
 if(!state.shop.phone.trim())missing.push('Ajoutez le numéro de téléphone de la boutique');
 if(!state.shop.address.trim())missing.push('Ajoutez une adresse de boutique');
 if(active.length===0)missing.push('Ajoutez au moins un produit actif et disponible');
 return {productCount:state.products.length,availableCount:active.length,missing,ready:missing.length===0};
}

export async function getMerchantOnboarding(userId:string){
 const workspace=await prisma.workspace.findUnique({
  where:{ownerId:userId},
  select:{
   id:true,slug:true,published:true,plan:true,subscriptionStatus:true,
   subscriptionEndsAt:true,data:true,
   shop:{select:{id:true,status:true}}
  }
 });
 if(!workspace)throw new HttpError(404,'Aucune boutique associée à ce marchand');
 const state=normalizeState(workspace.data as unknown as State);
 return {
  shop:{name:state.shop.name,phone:state.shop.phone,address:state.shop.address,
   description:state.shop.description||'',shipping:state.shop.shipping},
  slug:workspace.slug,
  published:isOpen(workspace),
  publicationRequested:workspace.published,
  plan:workspace.plan,
  subscriptionStatus:workspace.subscriptionStatus,
  subscriptionEndsAt:workspace.subscriptionEndsAt,
  linkedShopId:workspace.shop?.id||null,
  ...readiness(state)
 };
}

export async function updateMerchantOnboarding(userId:string,input:MerchantOnboardingAction){
 return prisma.$transaction(async tx=>{
  const row=await tx.workspace.findUnique({where:{ownerId:userId}});
  if(!row)throw new HttpError(404,'Boutique introuvable');
  const state=normalizeState(row.data as unknown as State);
  if(input.action==='details'){
   const updated=applyAction(state,'settings',{
    name:input.name,phone:input.phone,address:input.address,
    description:input.description,shipping:input.shipping
   });
   const saved=await tx.workspace.updateMany({
    where:{id:row.id,version:row.version},
    data:{data:updated as unknown as Prisma.InputJsonValue,version:{increment:1}}
   });
   if(saved.count!==1)throw new HttpError(409,'Modifications simultanées. Actualisez et réessayez.');
   await tx.shop.updateMany({where:{legacyWorkspaceId:row.id},data:{name:input.name}});
  }else if(input.action==='slug'){
   if(input.slug===row.slug)return {ok:true};
   const [workspaceCollision,shopCollision]=await Promise.all([
    tx.workspace.findUnique({where:{slug:input.slug},select:{id:true}}),
    tx.shop.findUnique({where:{slug:input.slug},select:{legacyWorkspaceId:true}})
   ]);
   if(workspaceCollision||shopCollision&&shopCollision.legacyWorkspaceId!==row.id)
    throw new HttpError(409,'Ce lien de boutique est déjà utilisé');
   const saved=await tx.workspace.updateMany({
    where:{id:row.id,version:row.version},data:{slug:input.slug,version:{increment:1}}
   });
   if(saved.count!==1)throw new HttpError(409,'Modifications simultanées. Actualisez et réessayez.');
   await tx.shop.updateMany({where:{legacyWorkspaceId:row.id},data:{slug:input.slug}});
  }else if(input.action==='publish'){
   const status=readiness(state);
   if(!status.ready)throw new HttpError(409,status.missing[0]);
   if(!isOpen({...row,published:true}))
    throw new HttpError(403,'Votre abonnement ne permet pas la publication actuellement');
   const saved=await tx.workspace.updateMany({
    where:{id:row.id,version:row.version},data:{published:true,version:{increment:1}}
   });
   if(saved.count!==1)throw new HttpError(409,'Modifications simultanées. Actualisez et réessayez.');
   await tx.shop.updateMany({where:{legacyWorkspaceId:row.id},data:{status:'PUBLISHED'}});
  }else{
   const saved=await tx.workspace.updateMany({
    where:{id:row.id,version:row.version},data:{published:false,version:{increment:1}}
   });
   if(saved.count!==1)throw new HttpError(409,'Modifications simultanées. Actualisez et réessayez.');
   await tx.shop.updateMany({where:{legacyWorkspaceId:row.id},data:{status:'DRAFT'}});
  }
  return {ok:true};
 });
}
