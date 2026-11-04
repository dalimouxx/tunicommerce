type ConfirmationOrder={id:string;status:string;callbackAt?:string;createdAt?:string};
type StockItem={id:string;active:boolean;stock:number;threshold:number};

export type CallbackPriority='OVERDUE'|'SCHEDULED'|'TO_CONFIRM'|'NO_ANSWER';

/** Pure read-only queue. Never changes an order's status or sends a message. */
export function confirmationQueue<T extends ConfirmationOrder>(orders:readonly T[],now=new Date()):Array<T&{priority:CallbackPriority}>{
 const clock=now.getTime();
 const priority=(order:T):CallbackPriority=>{
  if(order.status==='CALLBACK'){
   const when=Date.parse(order.callbackAt||'');
   return Number.isFinite(when)&&when>clock?'SCHEDULED':'OVERDUE';
  }
  return order.status==='TO_CONFIRM'?'TO_CONFIRM':'NO_ANSWER';
 };
 const rank:Record<CallbackPriority,number>={OVERDUE:0,TO_CONFIRM:1,NO_ANSWER:2,SCHEDULED:3};
 return orders.filter(o=>['CALLBACK','TO_CONFIRM','NO_ANSWER'].includes(o.status))
  .map(order=>({...order,priority:priority(order)}))
  .sort((a,b)=>{
   const byType=rank[a.priority]-rank[b.priority];
   if(byType)return byType;
   if(a.priority==='OVERDUE'||a.priority==='SCHEDULED'){
    const ta=Date.parse(a.callbackAt||''),tb=Date.parse(b.callbackAt||'');
    if(Number.isFinite(ta)&&Number.isFinite(tb)&&ta!==tb)return ta-tb;
   }
   const createdA=Date.parse(a.createdAt||''),createdB=Date.parse(b.createdAt||'');
   return (Number.isFinite(createdA)?createdA:0)-(Number.isFinite(createdB)?createdB:0);
  });
}

export function replenishmentQueue<T extends StockItem>(items:readonly T[]):Array<T&{suggestedMinimum:number;outOfStock:boolean}>{
 return items.filter(item=>item.active&&item.stock<=item.threshold)
  .map(item=>({
   ...item,
   outOfStock:item.stock===0,
   suggestedMinimum:Math.max(0,item.threshold-item.stock+1)
  }))
  .sort((a,b)=>Number(b.outOfStock)-Number(a.outOfStock)||a.stock-b.stock||a.id.localeCompare(b.id));
}

/** Client-side paging for already authorized merchant records, with no hidden cutoff. */
export function pageOperationalQueue<T>(records:readonly T[],requestedPage:number,pageSize=30){
 if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw Error('Taille de page invalide');
 const total=records.length,totalPages=Math.max(1,Math.ceil(total/pageSize));
 const page=Number.isSafeInteger(requestedPage)&&requestedPage>=1?
  Math.min(requestedPage,totalPages):1;
 return {items:records.slice((page-1)*pageSize,page*pageSize),page,total,totalPages,pageSize};
}
