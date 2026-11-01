import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import SetupWizard from './setup-wizard';

export const dynamic='force-dynamic';

export default async function MerchantSetupPage(){
 const user=await getCurrentUser();
 if(!user)redirect('/login');
 if(user.role==='ADMIN')redirect('/admin');
 const workspace=await prisma.workspace.findUnique({where:{ownerId:user.userId},select:{id:true}});
 if(!workspace)redirect('/equipe');
 return <SetupWizard/>;
}
