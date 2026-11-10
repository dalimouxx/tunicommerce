import {redirect} from 'next/navigation';
import {getCurrentUser,getSuperAdminUser} from '../modules/auth/session';
import TunicomLanding from '../components/tunicom-landing';

export const dynamic='force-dynamic';

// Visitors discover Tunicom; signed-in users retain their separate portal routing.
// Rendering the public page never creates a merchant workspace.
export default async function Home(){
 if(await getSuperAdminUser())redirect('/admin');
 if(await getCurrentUser())redirect('/mes-boutiques');
 return <TunicomLanding/>;
}
