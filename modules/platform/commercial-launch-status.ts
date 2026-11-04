/** Server-only declarations. A green CI build or a manually set flag is not evidence of actual compliance. */
export const commercialLaunchChecks=[
 {key:'P5_BACKUP_RESTORE_VERIFIED',label:'Sauvegarde hors site restaurée en environnement isolé'},
 {key:'P5_TENANT_BOUNDARIES_VERIFIED',label:'Isolation des données et permissions marchands vérifiée'},
 {key:'P5_MOBILE_COD_E2E_VERIFIED',label:'Parcours COD testé sur téléphones réels'},
 {key:'P5_DELIVERY_COD_PROOFS_VERIFIED',label:'Documents transporteurs et versements COD rapprochés'},
 {key:'P5_EXTERNAL_PROVIDER_SCOPE_VERIFIED',label:'Prestataires testés ou fonctions externes clairement désactivées'},
 {key:'P5_LEGAL_FISCAL_APPROVED',label:'Obligations fiscales et juridiques approuvées par professionnels'},
 {key:'P5_OBSERVABILITY_SUPPORT_READY',label:'Alertes incidents, support et plan de reprise validés'}
] as const;
/** Only boolean existence is returned. Never expose values of any environment secrets. */
export function commercialLaunchStatus(env:Record<string,string|undefined>){
 const rows=commercialLaunchChecks.map(item=>({
  key:item.key,label:item.label,declared:env[item.key]==='true'
 }));
 const declaredCount=rows.filter(row=>row.declared).length;
 return {rows,total:rows.length,declaredCount,missingCount:rows.length-declaredCount,
  allAttested:declaredCount===rows.length,externallyCertified:false,
  note:'Ces déclarations ne remplacent ni les preuves de tests, ni un audit fiscal, juridique ou bancaire.'};
}
