import {redirect} from 'next/navigation';
import {getCurrentUser} from '../modules/auth/session';
import CommerceApp from '../components/commerce-app';
export const dynamic='force-dynamic';
export default async function Page(){if(!await getCurrentUser())redirect('/login');return <CommerceApp/>;}
