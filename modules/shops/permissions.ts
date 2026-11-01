import {prisma} from '../storage/client';
import {HttpError} from '../auth/http';

export const shopRoles=['OWNER','ADMIN','MANAGER','CALL_CENTER','STOCK','DELIVERY_MANAGER','ACCOUNTANT','VIEWER'] as const;
export type ShopRole=(typeof shopRoles)[number];
export type ShopPermission='shops.read'|'shops.update'|'team.manage'|'orders.read'|'orders.create'|'orders.update'|'orders.cancel'|'orders.refund'|'products.read'|'products.write'|'stock.adjust'|'customers.read'|'finance.read'|'finance.write'|'settings.manage';
const all:readonly ShopPermission[]=['shops.read','shops.update','team.manage','orders.read','orders.create','orders.update','orders.cancel','orders.refund','products.read','products.write','stock.adjust','customers.read','finance.read','finance.write','settings.manage'];
const grants:Record<ShopRole,readonly ShopPermission[]>={
 OWNER:all,ADMIN:all,
 MANAGER:['shops.read','orders.read','orders.create','orders.update','orders.cancel','products.read','products.write','stock.adjust','customers.read','finance.read'],
 CALL_CENTER:['shops.read','orders.read','orders.create','orders.update','customers.read','products.read'],
 STOCK:['shops.read','orders.read','products.read','products.write','stock.adjust'],
 DELIVERY_MANAGER:['shops.read','orders.read','orders.update','customers.read'],
 ACCOUNTANT:['shops.read','orders.read','finance.read','finance.write'],
 VIEWER:['shops.read','orders.read','products.read']
};
export function canAccessShop(role:string,permission:ShopPermission):boolean{
 return Object.prototype.hasOwnProperty.call(grants,role)&&grants[role as ShopRole].includes(permission);
}
export async function requireShopPermission(userId:string,shopId:string,permission:ShopPermission){
 const membership=await prisma.membership.findUnique({where:{shopId_userId:{shopId,userId}},select:{role:true,active:true}});
 if(!membership?.active||!canAccessShop(membership.role,permission))throw new HttpError(403,'Accès boutique interdit');
 return membership;
}
