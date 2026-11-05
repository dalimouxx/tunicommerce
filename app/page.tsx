import {redirect} from 'next/navigation';
import {getCurrentUser,getSuperAdminUser} from '../modules/auth/session';

export const dynamic='force-dynamic';

// The entry point only chooses the user's space; it never creates a merchant
// workspace for the platform super-administrator.
export default async function Home(){
 if(await getSuperAdminUser())redirect('/admin');
 if(await getCurrentUser())redirect('/mes-boutiques');
 redirect('/connexion/boutique');
}
