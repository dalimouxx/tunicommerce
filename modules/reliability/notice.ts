/** Shown under every cash-on-delivery form: what is shared between Tunicom shops, and how to contest. */
export function reliabilityNotice(lang:'fr'|'ar'){
 return lang==='ar'?'لمكافحة الطلبات غير المستلمة، قد يُشارك عدد الطلبات المستلمة أو المرفوضة المرتبطة برقمك بين متاجر Tunicom (أرقام فقط). يمكنك الاعتراض على أي رفض عبر رابط تتبع طلبك.'
  :'Pour lutter contre les commandes non honorées, le nombre de livraisons réussies ou refusées associées à votre numéro peut être partagé entre les boutiques Tunicom (compteurs uniquement). Vous pouvez contester un refus depuis votre lien de suivi.';
}

/** Plain counts for the call center; nothing when the number has no finished order on Tunicom. */
export function reliabilityLabel(counts:{delivered:number;refused:number}){
 if(!counts.delivered&&!counts.refused)return null;
 const plural=(n:number,word:string)=>n+' '+word+(n>1?'s':'');
 return 'Historique Tunicom : '+plural(counts.delivered,'livrée')+' · '+plural(counts.refused,'refusée')+' (toutes boutiques)';
}
