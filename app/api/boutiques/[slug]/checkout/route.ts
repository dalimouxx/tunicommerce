import {getCurrentUser} from '../../../../../modules/auth/session';
import {randomBytes} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '../../../../../modules/storage/client';
import {isOpen} from '../../../../../modules/platform/public';
import {normalizeState} from '../../../../../modules/commerce/normalize';
import {applyAction} from '../../../../../modules/commerce/service';
import type {State} from '../../../../../modules/commerce/types';
import {assertSameOrigin,readJson,respond,HttpError} from '../../../../../modules/auth/http';
import {consumeAttempt} from '../../../../../modules/auth/service';
export async function POST(req:Request,{params}:{params:Promise<{slug:string}>}){try{
 assertSameOrigin(req);const {slug}=await params;const user=await getCurrentUser();const customerId=user?.role==='CUSTOMER'?user.userId:null;
 const input=z.object({requestId:z.string().uuid(),customer:z.object({name:z.string().trim().min(2).max(100),phone:z.string().max(12),city:z.string().max(40),address:z.string().trim().min(3).max(300)}),items:z.array(z.object({productId:z.string().max(100),quantity:z.number().int().min(1).max(100)})).min(1).max(100)}).parse(await readJson(req));
 const shop=await prisma.workspace.findUnique({where:{slug},select:{id:true}});if(!shop)throw new HttpError(404,'Boutique introuvable');
 await consumeAttempt('checkout:'+shop.id,100);
 const receipt=await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${shop.id} FOR UPDATE`;
 const row=await tx.workspace.findUniqueOrThrow({where:{id:shop.id}});if(!isOpen(row))throw new HttpError(403,'Cette boutique ne prend pas de commandes actuellement.');
 const previous=await tx.publicReceipt.findUnique({where:{workspaceId_requestId:{workspaceId:row.id,requestId:input.requestId}},select:{id:true,reference:true,total:true,customerId:true}});if(previous){if(previous.customerId!==customerId)throw new HttpError(409,"Cette tentative appartient à une autre session. Retrouvez votre compte d’origine.");return previous;}
 let next:State;try{next=applyAction(normalizeState(row.data as unknown as State),'createOrder',{...input.customer,items:input.items,source:'Boutique'});}catch(e){throw new HttpError(400,e instanceof Error?e.message:'Commande invalide');}
 const receiptId=randomBytes(32).toString('hex');next.orders[0].publicReceiptId=receiptId;
 await tx.workspace.update({where:{id:row.id},data:{data:next as unknown as Prisma.InputJsonValue,version:{increment:1}}});
 return tx.publicReceipt.create({data:{id:receiptId,customerId,workspaceId:row.id,requestId:input.requestId,reference:next.orders[0].reference,total:next.orders[0].total},select:{id:true,reference:true,total:true}});
 });return respond({reference:receipt.reference,total:receipt.total,trackingUrl:/^[a-f0-9]{64}$/.test(receipt.id)?'/suivi/'+receipt.id:null},201);
 }catch(e){if(e instanceof HttpError)return respond({error:e.message},e.status);if(e instanceof z.ZodError)return respond({error:'Vérifiez les informations de la commande.'},400);return respond({error:'Service indisponible. Réessayez avec le même panier.'},503);}}
