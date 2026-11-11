import {Resolver} from 'node:dns/promises';
import {proofPrefix,proofMatches} from './domains-validation';
import {HttpError} from '../auth/http';
export type TxtLookup=(hostname:string)=>Promise<string[][]>;
export async function resolveDomainProof(hostname:string){
 const resolver=new Resolver({timeout:2000,tries:1});
 if(process.env.DOMAIN_DNS_SERVERS)resolver.setServers(process.env.DOMAIN_DNS_SERVERS.split(',').map(value=>value.trim()).filter(Boolean));
 try{return await resolver.resolveTxt(hostname);}finally{resolver.cancel();}
}
export async function checkDomainProof(hostname:string,token:string,lookup:TxtLookup=resolveDomainProof){
 try{
  const records=await lookup(proofPrefix+hostname);
  if(!proofMatches(records,token))throw new HttpError(409,'Le TXT de vérification est absent ou ne correspond pas. Vérifiez le DNS puis réessayez.');
 }catch(error){
  if(error instanceof HttpError)throw error;
  const code=error&&typeof error==='object'&&'code' in error?error.code:'';
  if(code==='ENODATA'||code==='ENOTFOUND')throw new HttpError(409,'Le TXT de vérification est introuvable. La propagation DNS peut prendre du temps.');
  throw new HttpError(503,'Vérification DNS indisponible. Réessayez plus tard.');
 }
}
