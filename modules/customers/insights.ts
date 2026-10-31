import type {State,RiskSignal} from '../commerce/types';
export function customerTrust(s:State,customerId:string){const orders=s.orders.filter(o=>o.customerId===customerId);const delivered=orders.filter(o=>o.status==='DELIVERED').length;const refused=orders.filter(o=>o.status==='RETURNED').length;const reasons=[{points:50,label:'Base neutre pour chaque client'},{points:Math.min(35,delivered*5),label:`${delivered} commande(s) livrée(s) · +5 chacune, maximum +35`},{points:-Math.min(32,refused*8),label:`${refused} refus/retour(s) avant livraison · −8 chacun, maximum −32`},{points:delivered>=3?5:0,label:'Fidélité : au moins 3 commandes livrées'}];return {score:Math.max(0,Math.min(100,reasons.reduce((n,r)=>n+r.points,0))),reasons,delivered,refused,orders:orders.length};}
export function orderSignals(s:State,customerId:string,items:{productId:string;quantity:number}[],address:string,now=Date.now()):RiskSignal[]{const signals:RiskSignal[]=[];
 const duplicates=s.orders.filter(o=>o.customerId===customerId&&!['CANCELLED','RETURNED'].includes(o.status)&&now-Date.parse(o.createdAt)<86400000&&Date.parse(o.createdAt)<=now&&o.items.some(i=>items.some(x=>x.productId===i.productId)));
 if(duplicates.length)signals.push({code:'RECENT_SIMILAR',label:'Commande similaire dans les 24 dernières heures : '+duplicates.map(o=>o.reference).join(', '),level:'warning'});
 const quantity=items.reduce((n,i)=>n+i.quantity,0);if(quantity>=10)signals.push({code:'HIGH_QUANTITY',label:quantity+' articles commandés : vérifier la quantité avec le client',level:'info'});
 if(address.trim().length<12)signals.push({code:'SHORT_ADDRESS',label:'Adresse courte : confirmer la rue et un point de repère',level:'warning'});
 const trust=customerTrust(s,customerId);if(trust.refused>=2)signals.push({code:'PREVIOUS_REFUSALS',label:trust.refused+' refus/retours avant livraison dans cette boutique : demander le contexte au client',level:'warning'});
 return signals;
}
