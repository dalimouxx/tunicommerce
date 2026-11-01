import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import TeamClient from './team-client';

export const dynamic='force-dynamic';
export default async function TeamPage(){
 const user=await getCurrentUser();
 if(!user)redirect('/login');
 return <TeamClient userId={user.userId} userName={user.displayName}/>;
}
