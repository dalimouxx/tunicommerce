import {redirect} from 'next/navigation';
import {getSuperAdminUser} from './session';
/** Authorize before loading a page's data; parent layouts can render concurrently. */
export async function requireSuperAdminPage(){
 const actor=await getSuperAdminUser();
 if(!actor||actor.role!=='ADMIN')redirect('/connexion/admin');
 return actor;
}
