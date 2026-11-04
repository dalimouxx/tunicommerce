export type IntegrationKind='CARRIER'|'SMS'|'WHATSAPP'|'BANK_COD'|'AI';
export type IntegrationReadinessStatus='NOT_CONFIGURED'|'CREDENTIALS_PRESENT_UNVERIFIED';
export const integrationRequirements:readonly {kind:IntegrationKind;label:string;env:string[];purpose:string}[]=[
 {kind:'CARRIER',label:'Transporteur professionnel',env:['TUNICOMMERCE_CARRIER_API_BASE_URL','TUNICOMMERCE_CARRIER_API_TOKEN'],purpose:'Création des expéditions, étiquettes et suivi'},
 {kind:'SMS',label:'SMS',env:['TUNICOMMERCE_SMS_API_KEY','TUNICOMMERCE_SMS_SENDER_ID'],purpose:'Messages transactionnels consentis'},
 {kind:'WHATSAPP',label:'WhatsApp Business',env:['TUNICOMMERCE_WHATSAPP_API_TOKEN','TUNICOMMERCE_WHATSAPP_PHONE_ID'],purpose:'Confirmation et notifications opt-in'},
 {kind:'BANK_COD',label:'Vérification bancaire COD',env:['TUNICOMMERCE_BANK_RECONCILIATION_API_TOKEN'],purpose:'Contrôle des versements réels'},
 {kind:'AI',label:'Moteur IA externe',env:['TUNICOMMERCE_AI_API_KEY','TUNICOMMERCE_AI_MODEL'],purpose:'Copilot génératif marchand avec confidentialité et consentement'}
] as const;

/** Never output credentials or their values. Presence is not proof of working connectivity. */
export function integrationReadiness(env:Record<string,string|undefined>){
 return integrationRequirements.map(provider=>{
  const missing=provider.env.filter(key=>!env[key]?.trim());
  return {
   kind:provider.kind,label:provider.label,purpose:provider.purpose,
   configuredKeys:provider.env.length-missing.length,requiredKeys:provider.env.length,
   missingVariableNames:missing,
   status:(missing.length?'NOT_CONFIGURED':'CREDENTIALS_PRESENT_UNVERIFIED') as IntegrationReadinessStatus,
   connected:false,verified:false
  };
 });
}
