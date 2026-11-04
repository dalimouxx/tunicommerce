import {pathToFileURL} from 'node:url';

/** Explicit attestations: these are never an API probe or proof of external compliance. */
export const commercialLaunchControls=[
 {key:'P5_BACKUP_RESTORE_VERIFIED',label:'Sauvegarde externe restaurée sur environnement isolé'},
 {key:'P5_TENANT_BOUNDARIES_VERIFIED',label:'Accès multi-marchands et permissions revérifiés'},
 {key:'P5_MOBILE_COD_E2E_VERIFIED',label:'Parcours COD complet testé sur appareils réels'},
 {key:'P5_DELIVERY_COD_PROOFS_VERIFIED',label:'Bons transport et versements COD rapprochés avec justificatifs'},
 {key:'P5_EXTERNAL_PROVIDER_SCOPE_VERIFIED',label:'Transporteurs et messageries testés ou fonctionnalités non connectées désactivées'},
 {key:'P5_LEGAL_FISCAL_APPROVED',label:'CGV, confidentialité, fiscalité et documents revus par professionnels'},
 {key:'P5_OBSERVABILITY_SUPPORT_READY',label:'Alertes opérationnelles, astreinte, support et reprise incident validés'}
];
export function evaluateCommercialLaunch(env){
 const controls=commercialLaunchControls.map(control=>{
  const declared=env[control.key];
  return {...control,confirmed:declared==='true'};
 });
 return {ready:controls.every(control=>control.confirmed),
  total:controls.length,confirmed:controls.filter(control=>control.confirmed).length,
  blocked:controls.filter(control=>!control.confirmed).map(({key,label})=>({key,label}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=evaluateCommercialLaunch(process.env);
 if(result.ready){
  console.log('GO déclaré: 7/7 attestations saisies. Validation manuelle indépendante toujours requise; aucune publication automatique.');
 }else{
  console.error('NO-GO lancement TuniCommerce : '+result.confirmed+'/'+result.total+' attestations explicites.');
  for(const control of result.blocked)console.error('À valider : '+control.key+' — '+control.label);
  process.exitCode=1;
 }
}
