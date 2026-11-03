import type {Order} from '../commerce/types';

export const contactChannels=['Téléphone','WhatsApp','SMS'] as const;
export const contactOutcomes=['Réponse obtenue','Sans réponse','Numéro incorrect','Rappel demandé'] as const;
export type ContactChannel=(typeof contactChannels)[number];
export type ContactOutcome=(typeof contactOutcomes)[number];

const prefix='Contact manuel · ';
export function contactLogNote(channel:ContactChannel,outcome:ContactOutcome){
 if(!contactChannels.includes(channel)||!contactOutcomes.includes(outcome))throw Error('Résultat de contact non reconnu');
 const note=prefix+channel+' · '+outcome;
 if(note.length>160)throw Error('Note trop longue');
 return note;
}
export function contactHistory(order:Pick<Order,'events'>){
 return order.events.filter(event=>event.label.startsWith(prefix))
  .map(event=>({at:event.at,label:event.label.slice(prefix.length)}))
  .slice(-15).reverse();
}
export function contactHistoryStats<T extends Pick<Order,'events'>>(orders:readonly T[]){
 return {attempts:orders.reduce((n,order)=>n+contactHistory(order).length,0),
  ordersWithAttempts:orders.filter(order=>contactHistory(order).length>0).length};
}
