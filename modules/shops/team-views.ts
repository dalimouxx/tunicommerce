import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';
import {canAccessShop,type ShopPermission} from './permissions';
import type {Product,Order} from '../commerce/types';

/**
 * Authorize reads by membership and shop scope. The legacy commerce model stays private
 * to its owner: only the isolated ShopCommerce data is eligible for team access.
 */
export async function requireIsolatedReadPermission(userId:string,shopId:string,permission:ShopPermission){
 const membership=await prisma.membership.findUnique({
  where:{shopId_userId:{shopId,userId}},
  select:{active:true,role:true,shop:{select:{legacyWorkspaceId:true}}}
 });
 if(!membership)throw new HttpError(404,'Boutique introuvable');
 if(!membership.active||membership.shop.legacyWorkspaceId!==null||!canAccessShop(membership.role,permission))
  throw new HttpError(403,'Accès boutique interdit');
 return membership.role;
}

const seeCosts=new Set(['OWNER','ADMIN','MANAGER','ACCOUNTANT']);
export function projectProductsForRole(products:readonly Product[],role:string){
 if(seeCosts.has(role))return products;
 // Product cost must never be returned to STOCK, CALL_CENTER or VIEWER.
 return products.map(({cost: _cost,...product})=>product);
}
const seeCustomer=new Set(['OWNER','ADMIN','MANAGER','CALL_CENTER','DELIVERY_MANAGER']);
export function projectOrdersForRole(orders:readonly Order[],role:string){
 if(seeCustomer.has(role))return orders;
 // STOCK, VIEWER and ACCOUNTANT do not receive phone/address, free-form notes,
 // audit events, private snapshots, cost prices or risk signals.
 return orders.map(order=>({
  id:order.id,reference:order.reference,status:order.status,source:order.source,
  total:role==='ACCOUNTANT'?order.total:undefined,
  collected:role==='ACCOUNTANT'?order.collected:undefined,
  createdAt:order.createdAt,
  items:order.items.map(item=>({productId:item.productId,name:item.name,quantity:item.quantity}))
 }));
}
