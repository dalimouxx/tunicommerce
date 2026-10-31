import {z} from 'zod';
import {type State,governors} from '../commerce/types';
const text=z.string().trim().min(1).max(120),amount=z.number().int().min(0).max(10000000);
const regions=z.array(z.enum(governors as [string,...string[]])).min(1).max(24).refine(x=>new Set(x).size===x.length,'Gouvernorat dupliqué');
const zoneSchema=z.object({id:z.string().optional(),name:text,governorates:regions,fee:amount,freeAbove:amount.nullable(),estimatedDays:z.number().int().min(1).max(60),active:z.boolean()});
const carrierSchema=z.object({id:z.string().optional(),name:text,phone:z.string().max(30),governorates:regions,deliveryCost:amount,returnCost:amount,active:z.boolean()});
export function applyDelivery(s:State,action:string,payload:unknown){const now=new Date().toISOString();let label='';
 if(action==='saveZone'){const p=zoneSchema.parse(payload);if(p.active){const overlap=s.zones.find(z=>z.id!==p.id&&z.active&&z.governorates.some(g=>p.governorates.includes(g)));if(overlap)throw Error('Un gouvernorat est déjà couvert par la zone active « '+overlap.name+' »');}if(p.id){const zone=s.zones.find(z=>z.id===p.id);if(!zone)throw Error('Zone introuvable');Object.assign(zone,p);}else s.zones.push({...p,id:crypto.randomUUID()});label='Zone de livraison : '+p.name;}
 if(action==='saveCarrier'){const p=carrierSchema.parse(payload);if(s.carriers.some(c=>c.id!==p.id&&c.name.toLowerCase()===p.name.toLowerCase()))throw Error('Nom de transporteur déjà utilisé');if(p.id){const carrier=s.carriers.find(c=>c.id===p.id);if(!carrier)throw Error('Transporteur introuvable');Object.assign(carrier,p);}else s.carriers.push({...p,id:crypto.randomUUID()});label='Transporteur : '+p.name;}
 if(action==='shipmentCost'){const p=z.object({id:z.string(),deliveryCost:amount,returnCost:amount,reason:z.string().trim().min(3).max(300)}).parse(payload);const o=s.orders.find(o=>o.id===p.id);if(!o||!['SHIPPED','DELIVERED','RETURNED'].includes(o.status))throw Error('La commande doit être expédiée');o.deliveryCost=p.deliveryCost;o.returnDeliveryCost=p.returnCost;o.events.push({at:now,label:'Coûts transport corrigés · Aller '+(p.deliveryCost/1000).toFixed(3)+' DT · Refus '+(p.returnCost/1000).toFixed(3)+' DT · '+p.reason});label='Correction transport '+o.reference;}
 s.audit.unshift({id:crypto.randomUUID(),at:now,label});return s;
}
