import {z} from 'zod';
import type {State} from '../commerce/types';

export const warehouseMutation=z.discriminatedUnion('action',[
 z.object({action:z.literal('initializeWarehouses'),requestId:z.string().uuid(),payload:z.object({}).strict()}).strict(),
 z.object({action:z.literal('createWarehouse'),requestId:z.string().uuid(),
  payload:z.object({name:z.string().trim().min(2).max(80),code:z.string().trim().regex(/^[A-Z0-9_-]{2,20}$/)}).strict()}).strict(),
 z.object({action:z.literal('transferWarehouseStock'),requestId:z.string().uuid(),
  payload:z.object({productId:z.string().min(1).max(160),fromId:z.string().min(1).max(80),
   toId:z.string().min(1).max(80),quantity:z.number().int().min(1).max(100000),reference:z.string().trim().min(3).max(160)}).strict()}).strict()
]);

export function bootstrapWarehouses(state:State){
 if((state.warehouses||[]).length)throw Error('Emplacements déjà initialisés');
 state.warehouses=[{id:'primary',code:'PRINCIPAL',name:'Dépôt principal',active:true}];
 state.warehouseBalances=state.products.filter(p=>p.stock>0).map(p=>({productId:p.id,warehouseId:'primary',quantity:p.stock}));
 state.stockTransfers=[];
}
export function applyWarehouseMovement(state:State,productId:string,change:number){
 if(!(state.warehouses||[]).length||change===0)return;
 const product=state.products.find(p=>p.id===productId);
 if(!product)throw Error('Produit introuvable');
 const balances=state.warehouseBalances??(state.warehouseBalances=[]);
 const actual=balances.filter(b=>b.productId===productId).reduce((sum,b)=>sum+b.quantity,0);
 if(actual!==product.stock)throw Error('Incohérence entre stock global et emplacements. Audit requis.');
 if(change>0){
  let main=balances.find(b=>b.productId===productId&&b.warehouseId==='primary');
  if(!main){main={productId,warehouseId:'primary',quantity:0};balances.push(main);}
  main.quantity+=change;
 }else{
  let needed=-change;
  const sources=balances.filter(b=>b.productId===productId&&b.quantity>0)
   .sort((a,b)=>Number(b.warehouseId==='primary')-Number(a.warehouseId==='primary')||a.warehouseId.localeCompare(b.warehouseId));
  for(const balance of sources){
   const taken=Math.min(needed,balance.quantity);balance.quantity-=taken;needed-=taken;
   if(!needed)break;
  }
  if(needed)throw Error('Stock indisponible dans les emplacements');
 }
 state.warehouseBalances=balances.filter(b=>b.quantity>0);
}
export function applyWarehouseOperation(state:State,action:string,payload:unknown){
 const now=new Date().toISOString();
 if(action==='initializeWarehouses'){
  z.object({}).strict().parse(payload);bootstrapWarehouses(state);
  state.audit.unshift({id:crypto.randomUUID(),at:now,label:'Initialisation du stock multi-dépôt'});
  return state;
 }
 if(action==='createWarehouse'){
  const p=z.object({name:z.string().trim().min(2).max(80),
   code:z.string().trim().regex(/^[A-Z0-9_-]{2,20}$/)}).strict().parse(payload);
  if(!(state.warehouses||[]).length)throw Error('Initialisez les emplacements');
  if(state.warehouses!.length>=20)throw Error('Maximum 20 emplacements');
  if(state.warehouses!.some(x=>x.code===p.code||x.name.toLowerCase()===p.name.toLowerCase()))
   throw Error('Nom ou code de dépôt déjà utilisé');
  state.warehouses!.push({id:crypto.randomUUID(),name:p.name,code:p.code,active:true});
  state.audit.unshift({id:crypto.randomUUID(),at:now,label:'Création dépôt : '+p.name});
  return state;
 }
 if(action==='transferWarehouseStock'){
  const p=z.object({productId:z.string().min(1).max(160),fromId:z.string().min(1).max(80),
   toId:z.string().min(1).max(80),quantity:z.number().int().min(1).max(100000),
   reference:z.string().trim().min(3).max(160)}).strict().parse(payload);
  const locations=state.warehouses||[];
  if(p.fromId===p.toId||!locations.some(x=>x.id===p.fromId&&x.active)||!locations.some(x=>x.id===p.toId&&x.active))
   throw Error('Emplacement source/destination invalide');
  const product=state.products.find(x=>x.id===p.productId);
  if(!product)throw Error('Produit introuvable');
  const balances=state.warehouseBalances||[];
  const total=balances.filter(x=>x.productId===p.productId).reduce((sum,x)=>sum+x.quantity,0);
  if(total!==product.stock)throw Error('Incohérence entre stock global et emplacements. Audit requis.');
  const source=balances.find(x=>x.productId===p.productId&&x.warehouseId===p.fromId);
  if(!source||source.quantity<p.quantity)throw Error('Stock insuffisant dans le dépôt source');
  source.quantity-=p.quantity;
  let destination=balances.find(x=>x.productId===p.productId&&x.warehouseId===p.toId);
  if(!destination){destination={productId:p.productId,warehouseId:p.toId,quantity:0};balances.push(destination);}
  destination.quantity+=p.quantity;
  state.warehouseBalances=balances.filter(x=>x.quantity>0);
  state.stockTransfers??=[];
  if(state.stockTransfers.length>=10000)state.stockTransfers=state.stockTransfers.slice(0,9999);
  state.stockTransfers.unshift({id:crypto.randomUUID(),...p,at:now});
  state.audit.unshift({id:crypto.randomUUID(),at:now,label:'Transfert dépôt '+product.sku+' · '+p.reference});
  return state;
 }
 throw Error('Opération dépôt inconnue');
}
export function warehouseOverview(state:State){
 const locations=state.warehouses||[],balances=state.warehouseBalances||[];
 const inconsistencies=locations.length?state.products.filter(p=>
  balances.filter(b=>b.productId===p.id).reduce((sum,b)=>sum+b.quantity,0)!==p.stock).map(p=>p.sku):[];
 return {
  initialized:locations.length>0,locations:locations.map(x=>({...x})),
  products:state.products.slice(0,500).map(p=>({id:p.id,name:p.name,sku:p.sku,total:p.stock,
   byLocation:balances.filter(b=>b.productId===p.id&&b.quantity>0).map(b=>({...b}))})),
  transfers:(state.stockTransfers||[]).slice(0,50).map(x=>({...x})),
  inconsistencies:inconsistencies.slice(0,50)
 };
}
