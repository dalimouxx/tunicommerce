import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {prisma} from '../storage/client';
import {digest,hashPassword} from './crypto';
import {applicationOrigin,HttpError} from './http';
import {consumeAttempt} from './service';
import {portalRoleAllowed,type AuthPortal} from './portal';
import {emailConfigured} from '../messaging/email';
import {enqueueJob} from '../jobs/service';

export const actionPurpose=z.enum(['RESET_PASSWORD','VERIFY_EMAIL']);
export type AccountPurpose=z.infer<typeof actionPurpose>;
export const accountRequestInput=z.object({
 email:z.string().trim().email().max(254).transform(value=>value.toLowerCase()),
 portal:z.enum(['ADMIN','MERCHANT']).default('MERCHANT')
}).strict();
export const consumeAccountInput=z.object({
 token:z.string().regex(/^[a-f0-9]{64}$/),
 password:z.string().min(12,'Utilisez au moins 12 caractères').max(128).optional()
}).strict();
export const accountMailPayload=z.object({
 purpose:actionPurpose,email:z.email(),portal:z.enum(['ADMIN','MERCHANT']),
 tokenHash:z.string().regex(/^[a-f0-9]{64}$/),url:z.url()
}).strict();
export function accountActionUrl(purpose:AccountPurpose,token:string,portal:AuthPortal){
 const path=purpose==='RESET_PASSWORD'?'/compte/reinitialiser':'/compte/verifier';
 return applicationOrigin()+path+'#'+new URLSearchParams({jeton:token,portail:portal}).toString();
}
export async function requestAccountAction(email:string,purpose:AccountPurpose,portal:AuthPortal){
 if(!emailConfigured())throw new HttpError(503,'Les e-mails de sécurité ne sont pas encore disponibles. Contactez l’administration.');
 await consumeAttempt('account-mail:all',300);
 await consumeAttempt('account-mail:'+digest(email),3);
 const token=randomBytes(32).toString('hex'),tokenHash=digest(token);
 const url=accountActionUrl(purpose,token,portal);
 const user=await prisma.user.findUnique({where:{email},select:{id:true,email:true,role:true,emailVerifiedAt:true}});
 if(!user||!portalRoleAllowed(user.role,portal)||(purpose==='VERIFY_EMAIL'&&user.emailVerifiedAt))return;
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
  const current=await tx.user.findUnique({where:{id:user.id},select:{email:true,emailVerifiedAt:true,role:true}});
  if(!current||current.email!==email||!portalRoleAllowed(current.role,portal)||(purpose==='VERIFY_EMAIL'&&current.emailVerifiedAt))return;
  const subjectKey='account:'+user.id+':'+purpose;
  await tx.backgroundJob.updateMany({where:{subjectKey,status:{in:['PENDING','FAILED']}},
   data:{status:'CANCELLED',payload:null,finishedAt:new Date()}});
  await tx.accountActionToken.upsert({where:{userId_purpose:{userId:user.id,purpose}},
   create:{userId:user.id,purpose,email,tokenHash,expiresAt:new Date(Date.now()+(purpose==='RESET_PASSWORD'?30*60000:24*3600000))},
   update:{tokenHash,email,consumedAt:null,createdAt:new Date(),expiresAt:new Date(Date.now()+(purpose==='RESET_PASSWORD'?30*60000:24*3600000))}});
  await enqueueJob(tx,{kind:'ACCOUNT_EMAIL',subjectKey,dedupKey:'account:'+tokenHash,
   payload:{purpose,email,portal,tokenHash,url}});
  await tx.accountSecurityEvent.create({data:{userId:user.id,kind:purpose+'_REQUESTED'}});
 });
}
export async function consumeAccountAction(purpose:AccountPurpose,input:z.infer<typeof consumeAccountInput>){
 if(purpose==='RESET_PASSWORD'&&!input.password)throw new HttpError(400,'Nouveau mot de passe requis');
 const tokenHash=digest(input.token);
 await consumeAttempt('account-consume:all',500);
 await consumeAttempt('account-token:'+tokenHash,10);
 const candidate=await prisma.accountActionToken.findUnique({where:{tokenHash},select:{purpose:true,expiresAt:true,consumedAt:true}});
 if(!candidate||candidate.purpose!==purpose||candidate.consumedAt||candidate.expiresAt<=new Date())
  throw new HttpError(400,'Lien invalide, expiré ou déjà utilisé');
 const passwordHash=purpose==='RESET_PASSWORD'?await hashPassword(input.password!):null;
 await prisma.$transaction(async tx=>{
  const initial=await tx.accountActionToken.findUnique({where:{tokenHash},select:{userId:true}});
  if(!initial)throw new HttpError(400,'Lien invalide, expiré ou déjà utilisé');
  // Same lock order as issuance: the user first, then their action token.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${initial.userId} FOR UPDATE`;
  const row=await tx.accountActionToken.findUnique({where:{tokenHash},include:{user:{select:{email:true}}}});
  const now=new Date();
  if(!row||row.purpose!==purpose||row.consumedAt||row.expiresAt<=now||row.email!==row.user.email)
   throw new HttpError(400,'Lien invalide, expiré ou déjà utilisé');
  const consumed=await tx.accountActionToken.updateMany({where:{tokenHash,purpose,consumedAt:null,expiresAt:{gt:now}},data:{consumedAt:now}});
  if(consumed.count!==1)throw new HttpError(400,'Lien invalide, expiré ou déjà utilisé');
  if(passwordHash){
   await tx.user.update({where:{id:row.userId},data:{passwordHash,authVersion:{increment:1}}});
   await tx.session.deleteMany({where:{userId:row.userId}});
  }else await tx.user.update({where:{id:row.userId},data:{emailVerifiedAt:now}});
  await tx.backgroundJob.updateMany({where:{subjectKey:'account:'+row.userId+':'+purpose,status:'PENDING'},data:{status:'CANCELLED',payload:null,finishedAt:now}});
  await tx.accountSecurityEvent.create({data:{userId:row.userId,kind:purpose==='RESET_PASSWORD'?'PASSWORD_RESET':'EMAIL_VERIFIED'}});
 });
}
