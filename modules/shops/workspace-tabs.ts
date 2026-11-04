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
