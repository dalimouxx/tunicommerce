import {z} from 'zod';
import {getCurrentUser} from '../../../../modules/auth/session';
import {respond} from '../../../../modules/auth/http';
import {listMyInvitations} from '../../../../modules/shops/team';

export const dynamic='force-dynamic';
export async function GET(){
 try{
  const user=await getCurrentUser();
  if(!user)return respond({error:'Connexion requise'},401);
  return respond({invitations:await listMyInvitations(user.email)});
 }catch{return respond({error:'Service temporairement indisponible'},503);}
}
