export type ShopDossier={id:string;status:string;legacyWorkspaceId:string|null;initialized:boolean};
export type StaffSeat={userId:string;active:boolean};
export function merchantDossierSummary(shops:readonly ShopDossier[],seats:readonly StaffSeat[],ownerId:string){
 const active=new Set(seats.filter(s=>s.active&&s.userId!==ownerId).map(s=>s.userId));
 return {
  shops:shops.length,
  independent:shops.filter(s=>s.legacyWorkspaceId===null).length,
  legacyLinked:shops.filter(s=>s.legacyWorkspaceId!==null).length,
  publishedFlag:shops.filter(s=>s.status==='PUBLISHED').length,
  initialized:shops.filter(s=>s.initialized).length,
  distinctStaff:active.size
 };
}
