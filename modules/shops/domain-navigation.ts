import {Resolver} from 'node:dns/promises';
import {isIP} from 'node:net';
import {platformHosts} from './domains-validation';
/** Public routing instructions only. Never fetch a merchant-supplied URL. */
export async function domainNavigationTarget(){
 const hostname=platformHosts()[0]||'';
 if(!hostname||hostname.endsWith('.test'))return {hostname,ipv4:[] as string[]};
 const resolver=new Resolver({timeout:1500,tries:1});
 try{return {hostname,ipv4:[...new Set(await resolver.resolve4(hostname))].filter(ip=>isIP(ip)===4).slice(0,10)};}
 catch{return {hostname,ipv4:[] as string[]};}finally{resolver.cancel();}
}
