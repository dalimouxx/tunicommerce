import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {prisma} from '../../../../modules/storage/client';
import {canRequest} from '../../../../modules/platform/tracking';
import {normalizeState} from '../../../../modules/commerce/normalize';
import type {State} from '../../../../modules/commerce/types';
import {readJson,respond,HttpError} from '../../../../modules/auth/http';
import {assertPublicTrackingOrigin} from '../../../../modules/shops/domains-routing';
import {syncActivity} from '../../../../modules/shops/activity-index-service';
import {consumeAttempt} from '../../../../modules/auth/service';
export async function POST(req:Request,{params}:{params:Promise<{token:string}>}){
 try{
  const {token}=await params;await assertPublicTrackingOrigin(req,token);
  if(!/^[a-f0-9]{64}$/.test(token))throw new HttpError(404,'Lien introuvable');
  const input=z.object({id:z.string().uuid(),type:z.enum(['CANCEL','RETURN']),reason:z.string().trim().min(5).max(500)}).parse(await readJson(req));
  const receipt=await prisma.publicReceipt.findUnique({where:{id:token}});if(!receipt)throw new HttpError(404,'Lien introuvable');await consumeAttempt('request:'+receipt.workspaceId,100);
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${receipt.workspaceId} FOR UPDATE`;
   const row=await tx.workspace.findUniqueOrThrow({where:{id:receipt.workspaceId}}),before=normalizeState(row.data as unknown as State),state=structuredClone(before);
   const order=state.orders.find(o=>o.publicReceiptId===token);if(!order)throw new HttpError(404,'Commande introuvable');
   order.customerRequests??=[];if(order.customerRequests.some(r=>r.id===input.id))return;
   if(!canRequest(order,input.type))throw new HttpError(409,'Cette demande n’est pas disponible à cette étape.');
   if(order.customerRequests.some(r=>r.status==='PENDING'))throw new HttpError(409,'Une demande est déjà en cours.');
   if(order.customerRequests.length>=5)throw new HttpError(409,'Contactez directement le marchand.');
   const at=new Date().toISOString();order.customerRequests.push({...input,at,status:'PENDING'});order.events.push({at,label:'Demande client : '+(input.type==='CANCEL'?'annulation':'retour')});state.audit.unshift({id:crypto.randomUUID(),at,label:'Demande client · '+order.reference});
   await tx.workspace.update({where:{id:row.id},data:{data:state as unknown as Prisma.InputJsonValue,version:{increment:1}}});
   await syncActivity(tx,{workspaceId:row.id,ownerId:row.ownerId},before,state,row.activityVersion);
  });return respond({ok:true});
 }catch(e){if(e instanceof HttpError)return respond({error:e.message},e.status);if(e instanceof z.ZodError)return respond({error:'Indiquez un motif de 5 à 500 caractères.'},400);return respond({error:'Service indisponible'},503);}
}
