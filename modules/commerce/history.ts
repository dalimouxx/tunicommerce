import type {Prisma} from '@prisma/client';
import type {State} from './types';

/** Newest entries kept in the commerce JSON; the full history lives in CommerceJournalEntry / CommerceStockMovement. */
export const HISTORY_WINDOW=200;
type JournalRow={id:string;at:string;label:string};
type MovementRow={id:string;productId:string;label:string;quantity:number;at:string;orderId?:string};
const validDate=(value:unknown)=>typeof value==='string'&&!Number.isNaN(Date.parse(value));
const journalEntry=(row:unknown):row is JournalRow=>!!row&&typeof row==='object'&&typeof (row as JournalRow).id==='string'&&(row as JournalRow).id.length>0&&validDate((row as JournalRow).at)&&typeof (row as JournalRow).label==='string';
const movementEntry=(row:unknown):row is MovementRow=>journalEntry(row)&&typeof (row as MovementRow).productId==='string'&&Number.isFinite((row as MovementRow).quantity);

/** Pure: entries to store (all valid ones) and a copy of the state trimmed to the newest window. Business data is untouched. */
export function splitHistory(state:State){
 const audit=Array.isArray(state.audit)?state.audit:[],moves=Array.isArray(state.movements)?state.movements:[];
 return {
  journal:(audit as unknown[]).filter(journalEntry),
  movements:(moves as unknown[]).filter(movementEntry),
  state:{...state,audit:audit.slice(0,HISTORY_WINDOW),movements:moves.slice(0,HISTORY_WINDOW)} as State
 };
}
export type HistorySource={kind:'SHOP';id:string}|{kind:'WORKSPACE';id:string};
/** Stores the whole current window (catching entries added by any writer), then returns the trimmed state to save. */
export async function offloadHistory(tx:Prisma.TransactionClient,source:HistorySource,state:State):Promise<State>{
 const {journal,movements,state:trimmed}=splitHistory(state);
 for(let i=0;i<journal.length;i+=1000)await tx.commerceJournalEntry.createMany({skipDuplicates:true,data:journal.slice(i,i+1000).map(row=>({
  sourceKind:source.kind,sourceId:source.id,entryId:row.id,at:new Date(row.at),label:row.label.slice(0,2000)}))});
 for(let i=0;i<movements.length;i+=1000)await tx.commerceStockMovement.createMany({skipDuplicates:true,data:movements.slice(i,i+1000).map(row=>({
  sourceKind:source.kind,sourceId:source.id,entryId:row.id,productId:row.productId,label:row.label.slice(0,2000),quantity:Math.trunc(row.quantity),at:new Date(row.at),orderId:row.orderId||null}))});
 return trimmed;
}

/** One-off / repeatable catch-up: copies existing histories and trims every block, under the same lock and version check as writes. */
export async function offloadAllHistories(prisma:{$transaction:<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>,options?:{timeout?:number})=>Promise<T>;shopCommerce:{findMany:Function};workspace:{findMany:Function}}){
 const shops=await prisma.shopCommerce.findMany({select:{shopId:true,shop:{select:{organization:{select:{ownerId:true}}}}}}) as {shopId:string;shop:{organization:{ownerId:string}}}[];
 const workspaces=await prisma.workspace.findMany({select:{id:true,ownerId:true}}) as {id:string;ownerId:string}[];
 let trimmed=0;
 for(const target of [...shops.map(s=>({kind:'SHOP' as const,id:s.shopId,ownerId:s.shop.organization.ownerId})),...workspaces.map(w=>({kind:'WORKSPACE' as const,id:w.id,ownerId:w.ownerId}))]){
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${target.ownerId}))`;
   const row=target.kind==='SHOP'?await tx.shopCommerce.findUnique({where:{shopId:target.id},select:{data:true,version:true}}):await tx.workspace.findUnique({where:{id:target.id},select:{data:true,version:true}});
   if(!row)return;
   const state=row.data as unknown as State;
   const saved=await offloadHistory(tx,target,state);
   if((state.audit?.length||0)<=HISTORY_WINDOW&&(state.movements?.length||0)<=HISTORY_WINDOW)return;
   const data={data:saved as unknown as Prisma.InputJsonValue,version:{increment:1}};
   const result=target.kind==='SHOP'?await tx.shopCommerce.updateMany({where:{shopId:target.id,version:row.version},data}):await tx.workspace.updateMany({where:{id:target.id,version:row.version},data});
   if(result.count===1)trimmed++;
  },{timeout:60000});
 }
 return {sources:shops.length+workspaces.length,trimmed};
}

/** Full history of one source as CSV rows (newest first), for the shop owner's export. */
export async function historyCsv(prisma:{commerceJournalEntry:{findMany:Function};commerceStockMovement:{findMany:Function}},source:HistorySource,kind:'journal'|'movements',limit=100000){
 const {csvRow,csvCell}=await import('../billing/csv-export');
 const where={sourceKind:source.kind,sourceId:source.id};
 if(kind==='journal'){
  const rows=await prisma.commerceJournalEntry.findMany({where,orderBy:[{at:'desc'},{entryId:'asc'}],take:limit,select:{at:true,label:true}}) as {at:Date;label:string}[];
  return csvRow(['Date','Action'])+rows.map(row=>csvRow([row.at.toISOString(),row.label])).join('');
 }
 const rows=await prisma.commerceStockMovement.findMany({where,orderBy:[{at:'desc'},{entryId:'asc'}],take:limit,select:{at:true,productId:true,label:true,quantity:true,orderId:true}}) as {at:Date;productId:string;label:string;quantity:number;orderId:string|null}[];
 return csvRow(['Date','Produit','Motif','Quantité','Commande'])+rows.map(row=>[csvCell(row.at.toISOString()),csvCell(row.productId),csvCell(row.label),String(Math.trunc(row.quantity)),csvCell(row.orderId||'')].join(',')+'\r\n').join('');
}
