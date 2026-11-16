import {getCurrentUser} from '../../../../../../modules/auth/session';
import {HttpError,respond} from '../../../../../../modules/auth/http';
import {requireShopMembership} from '../../../../../../modules/shops/access';
import {prisma} from '../../../../../../modules/storage/client';
import {historyCsv} from '../../../../../../modules/commerce/history';
export const dynamic='force-dynamic';
/** Owner-only CSV export of the full journal or stock movements (?kind=journal|movements). */
export async function GET(req:Request,context:{params:Promise<{shopId:string}>}){
 try{
  const actor=await getCurrentUser();if(!actor)return respond({error:'Connexion requise'},401);
  const {shopId}=await context.params;
  const membership=await requireShopMembership(actor.userId,shopId);
  if(membership.role!=='OWNER')throw new HttpError(403,'Export réservé au propriétaire de la boutique');
  const requested=new URL(req.url).searchParams.get('kind');
  const kind=requested==='movements'?'movements':requested==='events'?'events':'journal';
  const shop=await prisma.shop.findUnique({where:{id:shopId},select:{legacyWorkspaceId:true}});
  if(!shop)throw new HttpError(404,'Boutique introuvable');
  const source=shop.legacyWorkspaceId?{kind:'WORKSPACE' as const,id:shop.legacyWorkspaceId}:{kind:'SHOP' as const,id:shopId};
  const body='﻿'+await historyCsv(prisma,source,kind);
  return new Response(body,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="'+(kind==='journal'?'journal':kind==='events'?'evenements-commandes-archivees':'mouvements-stock')+'-'+new Date().toISOString().slice(0,10)+'.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){
  if(error instanceof HttpError)return respond({error:error.message},error.status);
  return respond({error:'Export indisponible'},503);
 }
}
