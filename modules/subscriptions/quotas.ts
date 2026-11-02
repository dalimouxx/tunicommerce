import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import type {State} from '../commerce/types';
import {effectiveLimit} from './validation';

export type EnforcedQuotas={maxProducts:number|null;maxOrdersPerMonth:number|null;maxPhotos:number};
/**
 * NULL or 0 in a plan = unlimited; NULL in an override = inherited,
 * 0 in an override = unlimited. The physical photo cap remains 30.
 */
export async function loadWorkspaceQuotas(
 workspace:{id:string;plan:string},
 db:Pick<typeof prisma,'subscriptionPlan'|'workspacePlanOverride'>=prisma
):Promise<EnforcedQuotas>{
 const [plan,exception]=await Promise.all([
  db.subscriptionPlan.findUnique({
   where:{code:workspace.plan},
   select:{maxProducts:true,maxOrdersPerMonth:true,maxPhotos:true}
  }),
  db.workspacePlanOverride.findUnique({
   where:{workspaceId:workspace.id},
   select:{maxProducts:true,maxOrdersPerMonth:true,maxPhotos:true}
  })
 ]);
 return {
  maxProducts:effectiveLimit(plan?.maxProducts??null,exception?.maxProducts),
  maxOrdersPerMonth:effectiveLimit(plan?.maxOrdersPerMonth??null,exception?.maxOrdersPerMonth),
  maxPhotos:Math.min(30,effectiveLimit(plan?.maxPhotos??null,exception?.maxPhotos)??30)
 };
}

function tunisiaMonth(value:string|Date){
 const date=typeof value==='string'?new Date(value):value;
 return new Intl.DateTimeFormat('en-CA',{
  timeZone:'Africa/Tunis',year:'numeric',month:'2-digit'
 }).format(date);
}

export function assertCommerceQuotas(
 previous:State,next:State,quotas:EnforcedQuotas,now=new Date()
){
 const products=next.products.length;
 if(quotas.maxProducts!==null&&products>previous.products.length&&products>quotas.maxProducts)
  throw new HttpError(409,`Limite de produits atteinte pour cette offre (${quotas.maxProducts}). Contactez l'administrateur.`);
 if(quotas.maxOrdersPerMonth!==null&&next.orders.length>previous.orders.length){
  const month=tunisiaMonth(now);
  const count=next.orders.filter(order=>tunisiaMonth(order.createdAt)===month).length;
  if(count>quotas.maxOrdersPerMonth)
   throw new HttpError(409,`Limite de commandes mensuelles atteinte (${quotas.maxOrdersPerMonth}). Contactez l'administrateur.`);
 }
}

export async function quotasForOwner(ownerId:string){
 const workspace=await prisma.workspace.findUnique({
  where:{ownerId},select:{id:true,plan:true}
 });
 if(!workspace)throw new HttpError(404,'Boutique introuvable');
 return loadWorkspaceQuotas(workspace);
}
