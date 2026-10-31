import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {prisma} from '../../../../modules/storage/client';
import {requireAdmin} from '../../../../modules/platform/admin';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../modules/auth/http';
import {hashPassword} from '../../../../modules/auth/crypto';
import {initialState} from '../../../../modules/commerce/seed';
const config=z.object({slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),published:z.boolean(),plan:z.enum(['STARTER','PRO','BUSINESS']),subscriptionStatus:z.enum(['TRIAL','ACTIVE','SUSPENDED','CANCELLED']),subscriptionEndsAt:z.string().datetime()});
export async function POST(req:Request){try{
 assertSameOrigin(req);const actor=await requireAdmin();const body=await readJson(req);
 const input=z.discriminatedUnion('action',[z.object({action:z.literal('create'),name:z.string().trim().min(2).max(100),email:z.string().email().transform(v=>v.toLowerCase()),password:z.string().min(12).max(128),shopName:z.string().trim().min(2).max(100)}).merge(config),z.object({action:z.literal('update'),id:z.string().uuid()}).merge(config)]).parse(body);
 const {slug,published,plan,subscriptionStatus}=input;const data={slug,published,plan,subscriptionStatus,subscriptionEndsAt:new Date(input.subscriptionEndsAt)};
 const passwordHash=input.action==='create'?await hashPassword(input.password):'';
 await prisma.$transaction(async tx=>{
 let workspaceId:string;
 if(input.action==='create'){
 const state=initialState(false);state.shop.name=input.shopName;state.shop.address='';
 const user=await tx.user.create({data:{email:input.email,name:input.name,passwordHash,role:'MERCHANT'}});
 const workspace=await tx.workspace.create({data:{...data,ownerId:user.id,data:state as unknown as Prisma.InputJsonValue}});workspaceId=workspace.id;
 }else{workspaceId=input.id;await tx.workspace.update({where:{id:input.id},data});}
 await tx.platformAudit.create({data:{actorId:actor.userId,workspaceId,detail:JSON.stringify({action:input.action,...data})}});
 });return respond({ok:true});
 }catch(e){if(e instanceof HttpError)return respond({error:e.message},e.status);if(e instanceof z.ZodError)return respond({error:e.issues[0].message},400);if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')return respond({error:'Cet e-mail ou ce lien de boutique existe déjà.'},409);return respond({error:'Enregistrement impossible'},503);}}
