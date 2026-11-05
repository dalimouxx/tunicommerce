import {digest} from './crypto';
export type AuthPortal='ADMIN'|'MERCHANT';
/** Preserve merchant session hashes but separate global admin credential context. */
export function portalSessionHash(token:string,portal:AuthPortal):string{
 return digest(portal==='ADMIN'?'super-admin-session:'+token:token);
}
export function portalRoleAllowed(role:string,portal:AuthPortal):boolean{
 return portal==='ADMIN'?role==='ADMIN':role==='MERCHANT'||role==='ADMIN';
}
export const portalLanding=(portal:AuthPortal)=>portal==='ADMIN'?'/admin':'/mes-boutiques';
