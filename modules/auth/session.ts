import {cookies} from 'next/headers';
import {prisma} from '../storage/client';
import {newSession} from './crypto';
import {HttpError} from './http';
import {portalSessionHash,type AuthPortal} from './portal';
export const sessionCookie=()=>process.env.NODE_ENV==='production'?'__Host-tunicommerce':'tunicommerce_session';
export const adminSessionCookie=()=>process.env.NODE_ENV==='production'?'__Host-tunicommerce-admin':'tunicommerce_admin_session';
async function readPortalSession(portal:AuthPortal){
  const cookieName=portal==='ADMIN'?adminSessionCookie():sessionCookie();
  const token=(await cookies()).get(cookieName)?.value;
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const session=await prisma.session.findUnique({where:{tokenHash:portalSessionHash(token,portal)},include:{user:{select:{id:true,email:true,name:true,role:true,authVersion:true}}}});
  if(!session||session.expiresAt<=new Date()||session.authVersion!==session.user.authVersion)return null;
  if(portal==='ADMIN'&&session.user.role!=='ADMIN')return null;
  return {userId:session.user.id,email:session.user.email,displayName:session.user.name,role:session.user.role};
}
export async function getCurrentUser(){return readPortalSession('MERCHANT');}
export async function getSuperAdminUser(){return readPortalSession('ADMIN');}
export async function createSession(userId:string,portal:AuthPortal='MERCHANT',expectedVersion?:number){
  const s=newSession();await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
   const user=await tx.user.findUniqueOrThrow({where:{id:userId},select:{authVersion:true}});
   if(expectedVersion!==undefined&&expectedVersion!==user.authVersion)throw new HttpError(401,'Reconnectez-vous pour continuer');
   await tx.session.create({data:{tokenHash:portalSessionHash(s.token,portal),userId,expiresAt:s.expiresAt,authVersion:user.authVersion}});
  });
  const jar=await cookies();jar.set(portal==='ADMIN'?adminSessionCookie():sessionCookie(),s.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',expires:s.expiresAt});
}
export async function currentSessionHash(portal:AuthPortal){
 const token=(await cookies()).get(portal==='ADMIN'?adminSessionCookie():sessionCookie())?.value;
 return token&&/^[a-f0-9]{64}$/.test(token)?portalSessionHash(token,portal):undefined;
}
export async function revokeSession(portal:AuthPortal='MERCHANT'){
  const jar=await cookies();const cookieName=portal==='ADMIN'?adminSessionCookie():sessionCookie();
  const token=jar.get(cookieName)?.value;
  if(token)await prisma.session.deleteMany({where:{tokenHash:portalSessionHash(token,portal)}});
  jar.set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
}
