import {domainToASCII} from 'node:url';
import {isIP} from 'node:net';
import {z} from 'zod';
export const proofPrefix='_tunicom-verification.';
export function normalizeDomain(value:string):string|null{
 const raw=value.trim().replace(/\.$/,'');
 if(!raw||/[\s\/:@?#%\\]/.test(raw))return null;
 const host=domainToASCII(raw).toLowerCase();
 if(!host||host.length>253-proofPrefix.length||isIP(host))return null;
 const labels=host.split('.');
 if(labels.length<2||labels.some(label=>!label||label.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))return null;
 if(['localhost','local','internal','invalid','test','onion'].includes(labels.at(-1)!)||/^\d+$/.test(labels.at(-1)!))return null;
 return host;
}
export const domainMutation=z.discriminatedUnion('action',[
 z.object({action:z.literal('add'),hostname:z.string().max(500).transform((value,ctx)=>{const host=normalizeDomain(value);if(!host){ctx.addIssue({code:'custom',message:'Indiquez un nom de domaine valide, sans https:// ni chemin.'});return z.NEVER;}return host;})} ).strict(),
 ...(['verify','renew','remove'] as const).map(action=>z.object({action:z.literal(action),id:z.string().uuid()}).strict())
]);
export function platformHosts(env:Record<string,string|undefined>=process.env){
 return [env.APP_URL,env.RENDER_EXTERNAL_URL].filter(Boolean).map(value=>{try{return new URL(value!).hostname.toLowerCase();}catch{return '';}}).filter(Boolean);
}
export function storefrontRoot(env:Record<string,string|undefined>=process.env){return env.STOREFRONT_ROOT_DOMAIN?normalizeDomain(env.STOREFRONT_ROOT_DOMAIN):null;}
export function reservedDomain(host:string,env:Record<string,string|undefined>=process.env){
 const root=storefrontRoot(env);return [...platformHosts(env),...(root?[root]:[])].some(base=>host===base||host.endsWith('.'+base));
}
export function proofMatches(records:string[][],token:string){return records.some(parts=>parts.join('')==='tunicom='+token);}
export function automaticStoreSlug(host:string,env:Record<string,string|undefined>=process.env){
 const root=storefrontRoot(env);if(!root||!host.endsWith('.'+root))return null;
 const slug=host.slice(0,-root.length-1);return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length>=3&&slug.length<=60&&!['www','api','admin','app','mail','smtp','support','status'].includes(slug)?slug:null;
}

