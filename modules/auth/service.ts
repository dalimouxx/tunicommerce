import {prisma} from '../storage/client';
import {hashPassword,verifyPassword,secretMatches,digest} from './crypto';
import {HttpError} from './http';
import {portalRoleAllowed,type AuthPortal} from './portal';
import {consumeMfaProof} from './mfa';
// Persistent atomic buckets apply across processes. No untrusted forwarded-IP headers.
export async function consumeAttempt(key:string,limit:number){
  const now=new Date();const expiresAt=new Date(now.getTime()+10*60*1000);
  const rows=await prisma.$queryRaw<{count:number}[]>`INSERT INTO "AuthThrottle" (key,count,"expiresAt") VALUES (${key},1,${expiresAt}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN "AuthThrottle"."expiresAt" <= ${now} THEN 1 ELSE "AuthThrottle".count+1 END, "expiresAt"=CASE WHEN "AuthThrottle"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "AuthThrottle"."expiresAt" END RETURNING count`;
  if(rows[0].count>limit)throw new HttpError(429,'Trop de tentatives. Réessayez dans 10 minutes.');
}
export async function setupOwner(input:{email:string;name:string;password:string;token:string}){
  await consumeAttempt('setup',10);
  const expected=process.env.SETUP_TOKEN;
  if(!expected||expected.length<32)throw new HttpError(503,'Initialisation non configurée');
  if(!secretMatches(input.token,expected))throw new HttpError(403,'Clé d’initialisation incorrecte');
  if(await prisma.setupLock.findUnique({where:{id:1}}))throw new HttpError(409,'Le compte propriétaire existe déjà');
  const passwordHash=await hashPassword(input.password);
  try{return await prisma.$transaction(async tx=>{await tx.setupLock.create({data:{id:1}});return tx.user.create({data:{email:input.email,name:input.name,passwordHash,role:'ADMIN'},select:{id:true}});});}
  catch(e){if(typeof e==='object'&&e&&'code' in e&&e.code==='P2002')throw new HttpError(409,'Le compte propriétaire existe déjà');throw e;}
}
const dummyHash='scrypt:32768:8:1:'+ '0'.repeat(32)+':'+ '0'.repeat(128);
export async function authenticate(email:string,password:string,portal:AuthPortal='MERCHANT',otp?:string){
  await consumeAttempt('login:all',1000);
  await consumeAttempt('login:email:'+digest(email),20);
  const user=await prisma.user.findUnique({where:{email}});
  const valid=await verifyPassword(password,user?.passwordHash??dummyHash);
  if(!user||!valid||!portalRoleAllowed(user.role,portal))throw new HttpError(401,'E-mail ou mot de passe incorrect');
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
   const current=await tx.user.findUniqueOrThrow({where:{id:user.id}});
   if(current.passwordHash!==user.passwordHash||!portalRoleAllowed(current.role,portal))throw new HttpError(401,'E-mail ou mot de passe incorrect');
   await consumeMfaProof(tx,current,otp);
   return {id:current.id,role:current.role,authVersion:current.authVersion};
  });
}
