import {cookies} from 'next/headers';
import {prisma} from '../storage/client';
import {digest,newSession} from './crypto';
export const sessionCookie=()=>process.env.NODE_ENV==='production'?'__Host-tunicommerce':'tunicommerce_session';
export async function getCurrentUser(){
  const token=(await cookies()).get(sessionCookie())?.value;
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const session=await prisma.session.findUnique({where:{tokenHash:digest(token)},include:{user:{select:{id:true,email:true,name:true,role:true}}}});
  if(!session||session.expiresAt<=new Date())return null;
  return {userId:session.user.id,email:session.user.email,displayName:session.user.name,role:session.user.role};
}
export async function createSession(userId:string){
  const s=newSession();await prisma.session.create({data:{tokenHash:s.tokenHash,userId,expiresAt:s.expiresAt}});
  const jar=await cookies();jar.set(sessionCookie(),s.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',expires:s.expiresAt});
}
export async function revokeSession(){
  const jar=await cookies();const token=jar.get(sessionCookie())?.value;
  if(token)await prisma.session.deleteMany({where:{tokenHash:digest(token)}});
  jar.set(sessionCookie(),'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
}
