/** Operator-assisted templates. Never sends a message or records a delivery acknowledgement. */
export type MessageOrder={reference:string;status:string;tracking?:string;total?:number};
function safeLabel(value:string,max:number){
 return value.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
export function customerOrderMessage(order:MessageOrder,merchantName='Votre boutique'){
 const store=safeLabel(merchantName,70)||'Votre boutique';
 const ref=safeLabel(order.reference,80);
 if(!ref)throw Error('Référence commande manquante');
 const status=order.status;
 const text:Record<string,string>={
  TO_CONFIRM:'Votre commande a été enregistrée. Notre équipe vous contactera pour confirmation.',
  CALLBACK:'Notre équipe souhaite confirmer votre commande. Merci de nous indiquer un moment pour vous rappeler.',
  NO_ANSWER:'Nous avons tenté de confirmer votre commande. Merci de nous contacter.',
  CONFIRMED:'Votre commande est confirmée et sera bientôt préparée.',
  PREPARING:'Votre commande est en cours de préparation.',
  READY:'Votre commande est prête à être expédiée.',
  SHIPPED:'Votre commande a été expédiée.',
  DELIVERED:'Votre commande est indiquée comme livrée. Merci pour votre confiance.',
  CANCELLED:'Votre commande a été annulée. Pour toute question, contactez le marchand.',
  RETURNED:'Un retour a été enregistré pour votre commande. Contactez le marchand pour les détails.'
 };
 if(!Object.prototype.hasOwnProperty.call(text,status))throw Error('Statut de commande inconnu');
 const tracking=status==='SHIPPED'&&order.tracking?.trim()?' Numéro de suivi : '+safeLabel(order.tracking,100)+'.':'';
 return store+' · Commande '+ref+'. '+text[status]+tracking+' Ceci est un message préparé manuellement.';
}
export function tunisianWhatsAppUrl(phone:string,message:string){
 const normalized=phone.replace(/[\s.-]/g,'').replace(/^\+216/,'');
 if(!/^[2459][0-9]{7}$/.test(normalized))return null;
 if(!message||message.length>800)return null;
 return 'https://wa.me/216'+normalized+'?text='+encodeURIComponent(message);
}

/** Only a merchant-side selector. This never sends a message or exposes a public list. */
export function filterManualMessageOrders<T extends {reference:string;customerSnapshot?:{name?:string}}>(
 orders:readonly T[],search:string):T[]{
 const text=search.trim().toLocaleLowerCase('fr').slice(0,80);
 if(!text)return [...orders];
 return orders.filter(o=>o.reference.toLocaleLowerCase('fr').includes(text)||
  (o.customerSnapshot?.name||'').toLocaleLowerCase('fr').includes(text));
}
