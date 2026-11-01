import {redirect} from 'next/navigation';
import {getCurrentUser} from '../modules/auth/session';

export const dynamic='force-dynamic';

// The entry point only chooses the user's space; it never creates a merchant
// workspace for the platform super-administrator.
export default async function Home(){
 const user=await getCurrentUser();
 if(!user)redirect('/login');
 redirect(user.role==='ADMIN'?'/admin':'/marchand');
}
