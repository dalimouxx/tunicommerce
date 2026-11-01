import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {requireShopPermission} from './permissions';
import type {StaffRole} from './team-validation';

const inviteProjection={
 id:true,email:true,role:true,expiresAt:true,acceptedAt:true,revokedAt:true,createdAt:true
} as const;
const memberProjection={
 id:true,role:true,active:true,createdAt:true,user:{select:{id:true,email:true,name:true}}
} as const;
const sevenDays=7*24*60*60*1000;

export async function inviteShopMember(actorId:string,shopId:string,email:string,role:StaffRole){
 const actor=await requireShopPermission(actorId,shopId,'team.manage');
 if(role==='ADMIN'&&actor.role!=='OWNER')throw new HttpError(403,'Seul le propriétaire peut inviter un administrateur');
 const account=await prisma.user.findUnique({where:{email},select:{id:true}});
 if(account){
  const member=await prisma.membership.findUnique({where:{shopId_userId:{shopId,userId:account.id}}});
  if(member?.active||member?.role==='OWNER')throw new HttpError(409,'Cette personne possède déjà un accès');
 }
 const expiresAt=new Date(Date.now()+sevenDays);
 const invitation=await prisma.shopInvitation.upsert({
  where:{shopId_email:{shopId,email}},
  create:{shopId,email,role,invitedById:actorId,expiresAt},
  update:{role,invitedById:actorId,expiresAt,acceptedAt:null,revokedAt:null},
  select:inviteProjection
 });
 // Invitations appear in the invitee's authenticated inbox; no email is sent here.
 return invitation;
}

export async function listShopInvitations(actorId:string,shopId:string){
 await requireShopPermission(actorId,shopId,'team.manage');
 return prisma.shopInvitation.findMany({
  where:{shopId},select:inviteProjection,orderBy:{createdAt:'desc'},take:100
 });
}

export async function revokeShopInvitation(actorId:string,shopId:string,invitationId:string){
 await requireShopPermission(actorId,shopId,'team.manage');
 const invitation=await prisma.shopInvitation.findFirst({
  where:{id:invitationId,shopId},select:{id:true,role:true}
 });
 if(!invitation)throw new HttpError(404,'Invitation introuvable');
 const actor=await requireShopPermission(actorId,shopId,'team.manage');
 if(invitation.role==='ADMIN'&&actor.role!=='OWNER')
  throw new HttpError(403,'Seul le propriétaire peut révoquer cette invitation');
 const result=await prisma.shopInvitation.updateMany({
  where:{id:invitationId,shopId,acceptedAt:null,revokedAt:null},
  data:{revokedAt:new Date()}
 });
 if(result.count!==1)throw new HttpError(409,'Invitation déjà utilisée ou révoquée');
 return {revoked:true};
}

export async function listMyInvitations(email:string){
 return prisma.shopInvitation.findMany({
  where:{email,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},
  select:{
   id:true,role:true,expiresAt:true,createdAt:true,
   shop:{select:{id:true,name:true,organization:{select:{name:true}}}}
  },
  orderBy:{createdAt:'desc'},take:100
 });
}

export async function acceptShopInvitation(user:{userId:string,email:string},invitationId:string){
 return prisma.$transaction(async tx=>{
  const invitation=await tx.shopInvitation.findUnique({where:{id:invitationId}});
  if(!invitation||invitation.email!==user.email)throw new HttpError(404,'Invitation introuvable');
  const now=new Date();
  if(invitation.acceptedAt||invitation.revokedAt||invitation.expiresAt<=now)
   throw new HttpError(409,'Invitation expirée ou déjà utilisée');
  const existing=await tx.membership.findUnique({
   where:{shopId_userId:{shopId:invitation.shopId,userId:user.userId}}
  });
  if(existing?.role==='OWNER')throw new HttpError(409,'Le propriétaire conserve son rôle');
  if(existing?.active)throw new HttpError(409,'Vous avez déjà accès à cette boutique');
  const claimed=await tx.shopInvitation.updateMany({
   where:{id:invitation.id,email:user.email,acceptedAt:null,revokedAt:null,expiresAt:{gt:now}},
   data:{acceptedAt:now}
  });
  if(claimed.count!==1)throw new HttpError(409,'Invitation déjà utilisée');
  const member=await tx.membership.upsert({
   where:{shopId_userId:{shopId:invitation.shopId,userId:user.userId}},
   create:{shopId:invitation.shopId,userId:user.userId,role:invitation.role,active:true},
   update:{role:invitation.role,active:true},
   select:{id:true,shopId:true,role:true,active:true}
  });
  return member;
 });
}

export async function changeShopMember(actorId:string,shopId:string,memberId:string,change:{action:'setRole',role:StaffRole}|{action:'setActive',active:boolean}){
 const actor=await requireShopPermission(actorId,shopId,'team.manage');
 return prisma.$transaction(async tx=>{
  const target=await tx.membership.findFirst({
   where:{id:memberId,shopId},select:{id:true,userId:true,role:true}
  });
  if(!target)throw new HttpError(404,'Membre introuvable');
  if(target.userId===actorId)throw new HttpError(403,'Vous ne pouvez pas modifier votre propre accès');
  if(target.role==='OWNER')throw new HttpError(403,'Le propriétaire ne peut pas être modifié');
  if(target.role==='ADMIN'&&actor.role!=='OWNER')
   throw new HttpError(403,'Seul le propriétaire peut modifier un administrateur');
  if(change.action==='setRole'&&change.role==='ADMIN'&&actor.role!=='OWNER')
   throw new HttpError(403,'Seul le propriétaire peut attribuer le rôle administrateur');
  return tx.membership.update({
   where:{id:target.id},
   data:change.action==='setRole'?{role:change.role}:{active:change.active},
   select:memberProjection
  });
 });
}
