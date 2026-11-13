import {isIP} from 'node:net';
export function vpsEnvironmentErrors(env,{allowTestDomain=false}={}){
 const errors=[],hex=/^[a-f0-9]{64}$/;
 for(const key of ['POSTGRES_PASSWORD','APP_DATABASE_PASSWORD','APP_ENCRYPTION_SECRET'])if(!hex.test(env[key]||''))errors.push(key+' : 64 caractères hexadécimaux requis');
 const secrets=['POSTGRES_PASSWORD','APP_DATABASE_PASSWORD','APP_ENCRYPTION_SECRET'].map(key=>env[key]);
 if(new Set(secrets).size!==3)errors.push('Les trois secrets doivent être distincts');
 if(env.SETUP_TOKEN&&!hex.test(env.SETUP_TOKEN))errors.push('SETUP_TOKEN : format invalide');
 if(env.SETUP_TOKEN&&secrets.includes(env.SETUP_TOKEN))errors.push('SETUP_TOKEN doit être distinct des autres secrets');
 const host=value=>typeof value==='string'&&value.length<=253&&!isIP(value)&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value)&&value.split('.').every(part=>part.length<=63)&&
  (allowTestDomain||!/(?:^|\.)(?:test|example|invalid|localhost)$/.test(value));
 if(!host(env.PLATFORM_DOMAIN))errors.push('PLATFORM_DOMAIN : nom de domaine réel requis');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ACME_EMAIL||'')||!allowTestDomain&&!host((env.ACME_EMAIL||'').split('@')[1]))errors.push('ACME_EMAIL : adresse réelle requise');
 if(!['disabled','enabled',undefined,''].includes(env.STOREFRONT_DOMAIN_ROUTING))errors.push('STOREFRONT_DOMAIN_ROUTING : valeur invalide');
 if(env.STOREFRONT_DOMAIN_ROUTING==='enabled'&&!host(env.STOREFRONT_ROOT_DOMAIN))errors.push('STOREFRONT_ROOT_DOMAIN : domaine requis pour activer le routage');
 if(!['database','filesystem-mirror',undefined,''].includes(env.MEDIA_STORAGE_MODE))errors.push('MEDIA_STORAGE_MODE : valeur invalide');
 if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(env.TUNICOM_IMAGE_TAG||'local'))errors.push('TUNICOM_IMAGE_TAG : valeur invalide');
 return errors;
}
