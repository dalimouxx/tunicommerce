export const merchantWorkspaceTabs=[
 {id:'orders',label:'Commandes',description:'Créer, rechercher et suivre les commandes.'},
 {id:'catalog',label:'Catalogue et stocks',description:'Produits, entrepôts, stock et codes promo.'},
 {id:'callcenter',label:'Call Center',description:'Confirmation, rappels et affectations agents.'},
 {id:'delivery',label:'Livraison',description:'Transporteurs, expéditions et bons de remise.'},
 {id:'finance',label:'Finances',description:'COD, bordereaux, rapprochements, dépenses et retours.'},
 {id:'growth',label:'Clients et vitrine',description:'Clients, thèmes et analyses marchandes.'}
] as const;
export type MerchantWorkspaceTab=(typeof merchantWorkspaceTabs)[number]['id'];
export function isMerchantWorkspaceTab(value:string):value is MerchantWorkspaceTab{
 return merchantWorkspaceTabs.some(tab=>tab.id===value);
}

/** A hash fragment is navigation state only; never includes an order ID or buyer PII. */
export function merchantWorkspaceHash(value:MerchantWorkspaceTab):string{
 return '#espace='+value;
}
export function parseMerchantWorkspaceHash(hash:string):MerchantWorkspaceTab|null{
 const match=/^#espace=([a-z]+)$/.exec(hash);
 return match&&isMerchantWorkspaceTab(match[1])?match[1]:null;
}
