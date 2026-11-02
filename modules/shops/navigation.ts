export type ShopAccessSummary={
 id:string;
 legacyWorkspaceId:string|null;
 status:string;
 active:boolean;
 role:string;
};
export function shopAccess(entry:ShopAccessSummary,ownWorkspaceId:string|null){
 const canAccess=entry.active;
 const manageOwnCommerce=canAccess&&!!ownWorkspaceId&&entry.legacyWorkspaceId===ownWorkspaceId&&entry.role==='OWNER';
 return {
  manageOwnCommerce,
  mayOpenTeam:canAccess,
  // Public links are rendered by the server only if the actual linked workspace is open.
  explanation:!canAccess?'Accès désactivé':manageOwnCommerce?'Gestion personnelle disponible':
   entry.legacyWorkspaceId?'Accès équipe uniquement pour le moment':'Gestion commerciale multi-boutique en préparation'
 };
}
