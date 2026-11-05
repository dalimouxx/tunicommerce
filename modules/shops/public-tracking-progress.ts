export type PublicTrackingStep={id:string;label:string;state:'DONE'|'CURRENT'|'UPCOMING'};

/** Public information strictly derived from the current order status.
 * Never exposes internal audits, customer contacts or invented delivery timestamps.
 */
export function publicTrackingProgress(status:string){
 const stages=[
  {id:'RECEIVED',label:'Commande reçue'},
  {id:'CONFIRMED',label:'Commande confirmée'},
  {id:'PREPARING',label:'Préparation'},
  {id:'READY',label:'Prête à expédier'},
  {id:'SHIPPED',label:'Expédiée'},
  {id:'DELIVERED',label:'Livrée'}
 ] as const;
 if(status==='CANCELLED')
  return {steps:[{id:'CANCELLED',label:'Commande annulée',state:'CURRENT' as const}],
   note:'La commande est annulée. Contactez le marchand pour toute question.',terminal:true};
 if(status==='RETURNED')
  return {steps:[{id:'RETURNED',label:'Retour enregistré',state:'CURRENT' as const}],
   note:'Un retour est enregistré. Un remboursement éventuel doit être confirmé par le marchand.',terminal:true};
 const stage:Record<string,number>={
  TO_CONFIRM:0,CALLBACK:0,NO_ANSWER:0,CONFIRMED:1,PREPARING:2,
  READY:3,SHIPPED:4,DELIVERED:5
 };
 const current=stage[status];
 if(current===undefined)return {steps:[] as PublicTrackingStep[],
  note:'Le suivi détaillé est temporairement indisponible.',terminal:false};
 const notes:Record<string,string>={
  TO_CONFIRM:'Le marchand doit confirmer la commande avant sa préparation.',
  CALLBACK:'Un rappel de confirmation est prévu ou nécessaire. Contactez le marchand si besoin.',
  NO_ANSWER:'La boutique n’a pas encore pu confirmer la commande.',
  CONFIRMED:'Commande confirmée par le marchand.',
  PREPARING:'La boutique prépare les articles.',
  READY:'La commande est indiquée prête à être expédiée.',
  SHIPPED:'Expédition déclarée par le marchand ; le suivi du transporteur n’est pas automatiquement vérifié.',
  DELIVERED:'La livraison est déclarée par le marchand, sans validation automatique du règlement COD.'
 };
 return {
  steps:stages.map((step,index):PublicTrackingStep=>({
   id:step.id,label:step.label,state:index<current?'DONE':index===current?'CURRENT':'UPCOMING'
  })),
  note:notes[status],terminal:status==='DELIVERED'
 };
}
