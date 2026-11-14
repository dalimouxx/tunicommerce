import {automaticStoreSlug,normalizeDomain,storefrontRoot} from './domains-validation';
export function automaticStorefrontHostname(slug:string,env:Record<string,string|undefined>=process.env){
 const root=storefrontRoot(env),candidate=root?normalizeDomain(slug+'.'+root):null;
 return candidate&&automaticStoreSlug(candidate,env)===slug?candidate:null;
}
export function automaticStorefrontAddress(slug:string,fallback:string,env:Record<string,string|undefined>=process.env){
 const host=env.STOREFRONT_DOMAIN_ROUTING==='enabled'?automaticStorefrontHostname(slug,env):null;
 return host?'https://'+host:fallback;
}
