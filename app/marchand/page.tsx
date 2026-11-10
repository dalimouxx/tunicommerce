import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import {isOpen} from '../../modules/platform/public';
import CommerceApp from '../../components/commerce-app';

export const dynamic='force-dynamic';

export default async function MerchantDashboard(){
 const user=await getCurrentUser();
 if(!user)redirect('/connexion/boutique');
 // Administrators may manage only their OWN legacy boutique here; global management stays at /admin.

 const workspace=await prisma.workspace.findUnique({
  where:{ownerId:user.userId},
  select:{slug:true,published:true,subscriptionStatus:true,subscriptionEndsAt:true}
 });
 // Team members without an owner workspace must not receive a misleading
 // personal commerce dashboard. The new team area remains separate.
 if(!workspace){
  if(user.role==='ADMIN')redirect('/connexion/admin');
  const membership=await prisma.membership.findFirst({
   where:{userId:user.userId,active:true},select:{id:true}
  });
  if(membership)redirect('/equipe');
  redirect('/mes-boutiques');
 }
 const shopSlug=workspace?.slug&&isOpen({
  published:workspace.published,
  subscriptionStatus:workspace.subscriptionStatus,
  subscriptionEndsAt:workspace.subscriptionEndsAt
 })?workspace.slug:null;

 return <CommerceApp shopSlug={shopSlug}/>;
}
