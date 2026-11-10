import {randomBytes} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {prisma} from '../storage/client';
import {HttpError,MfaChallengeError} from './http';
import {digest,verifyPassword} from './crypto';
import {seal,open,encryptionConfigured} from '../security/envelope';
import {authenticatorSecret,base32,matchingTotpStep} from './totp';

type MfaUser={id:string;mfaEnabledAt:Date|null;mfaSecret:string|null;mfaLastStep:number|null};
export async function consumeMfaProof(tx:Prisma.TransactionClient,user:MfaUser,proof:string|undefined){
 if(!user.mfaEnabledAt)return;
 if(!proof)throw new MfaChallengeError();
 if(/^\d{6}$/.test(proof)){
  let secret:Buffer;
  try{const data=open(user.mfaSecret||'','mfa:'+user.id) as {secret:string};secret=Buffer.from(data.secret,'base64');}
  catch{throw new HttpError(503,'Double authentification temporairement indisponible.');}
  const step=matchingTotpStep(secret,proof);
  if(step===null||(user.mfaLastStep!==null&&step<=user.mfaLastStep))throw new MfaChallengeError();
  const updated=await tx.user.updateMany({where:{id:user.id,OR:[{mfaLastStep:null},{mfaLastStep:{lt:step}}]},data:{mfaLastStep:step}});
  if(updated.count!==1)throw new MfaChallengeError();
 }else{
  const code=proof.trim().replace(/-/g,'').toLowerCase();
  if(!/^[0-9a-f]{16}$/.test(code))throw new MfaChallengeError();
  const saved=await tx.mfaRecoveryCode.updateMany({where:{userId:user.id,codeHash:digest(code),usedAt:null},data:{usedAt:new Date()}});
  if(saved.count!==1)throw new MfaChallengeError();
  await tx.accountSecurityEvent.create({data:{userId:user.id,kind:'MFA_RECOVERY_CODE_USED'}});
 }
}
async function passwordUser(userId:string,password:string){
 const user=await prisma.user.findUnique({where:{id:userId},select:{id:true,email:true,passwordHash:true}});
 if(!user||!await verifyPassword(password,user.passwordHash))throw new HttpError(401,'Mot de passe incorrect');
 return user;
}
async function preserveSession(tx:Prisma.TransactionClient,userId:string,hash:string|undefined,authVersion:number){
 await tx.session.deleteMany({where:{userId,...(hash?{tokenHash:{not:hash}}:{})}});
 if(hash)await tx.session.updateMany({where:{userId,tokenHash:hash},data:{authVersion}});
}
export async function beginMfa(userId:string,password:string){
 if(!encryptionConfigured())throw new HttpError(503,'Double authentification non configurée par l’administration');
 const user=await passwordUser(userId,password),secret=authenticatorSecret();
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const current=await tx.user.findUniqueOrThrow({where:{id:userId},select:{passwordHash:true,mfaEnabledAt:true}});
  if(current.passwordHash!==user.passwordHash)throw new HttpError(409,'Reconnectez-vous avant de continuer');
  if(current.mfaEnabledAt)throw new HttpError(409,'La double authentification est déjà activée');
  await tx.user.update({where:{id:userId},data:{mfaPendingSecret:seal({secret:secret.toString('base64')},'mfa-pending:'+userId),mfaPendingExpiresAt:new Date(Date.now()+15*60000)}});
 });
 const display=base32(secret);
 return {secret:display,uri:'otpauth://totp/'+encodeURIComponent('Tunicom:'+user.email)+'?'+
  new URLSearchParams({secret:display,issuer:'Tunicom',algorithm:'SHA1',digits:'6',period:'30'}).toString()};
}
export async function configureMfa(userId:string,input:{action:'confirm'|'disable'|'recovery';password:string;otp:string},sessionHash:string|undefined){
 const user=await passwordUser(userId,input.password);
 const codes=Array.from({length:10},()=>randomBytes(8).toString('hex'));
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const current=await tx.user.findUniqueOrThrow({where:{id:userId}});
  if(current.passwordHash!==user.passwordHash)throw new HttpError(409,'Reconnectez-vous avant de continuer');
  const authVersion=current.authVersion+1;
  if(input.action==='confirm'){
   if(current.mfaEnabledAt||!current.mfaPendingSecret||!current.mfaPendingExpiresAt||current.mfaPendingExpiresAt<=new Date())
    throw new HttpError(409,'Recommencez la préparation de la double authentification');
   const data=open(current.mfaPendingSecret,'mfa-pending:'+userId) as {secret:string};
   const step=matchingTotpStep(Buffer.from(data.secret,'base64'),input.otp);
   if(step===null)throw new HttpError(400,'Code de confirmation incorrect');
   await tx.user.update({where:{id:userId},data:{mfaSecret:seal(data,'mfa:'+userId),mfaEnabledAt:new Date(),mfaLastStep:step,
    mfaPendingSecret:null,mfaPendingExpiresAt:null,authVersion}});
  }else{
   if(!current.mfaEnabledAt)throw new HttpError(409,'Double authentification inactive');
   await consumeMfaProof(tx,current,input.otp);
   await tx.user.update({where:{id:userId},data:{authVersion,...(input.action==='disable'?{
    mfaSecret:null,mfaEnabledAt:null,mfaLastStep:null,mfaPendingSecret:null,mfaPendingExpiresAt:null}: {})}});
  }
  await tx.mfaRecoveryCode.deleteMany({where:{userId}});
  if(input.action!=='disable')await tx.mfaRecoveryCode.createMany({data:codes.map(code=>({userId,codeHash:digest(code)}))});
  await preserveSession(tx,userId,sessionHash,authVersion);
  await tx.accountSecurityEvent.create({data:{userId,kind:input.action==='confirm'?'MFA_ENABLED':input.action==='disable'?'MFA_DISABLED':'MFA_RECOVERY_CODES_RENEWED'}});
 });
 return {recoveryCodes:input.action==='disable'?[]:codes.map(code=>code.slice(0,4)+'-'+code.slice(4,8)+'-'+code.slice(8,12)+'-'+code.slice(12))};
}
