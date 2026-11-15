import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import SetupWizard from './setup-wizard';
import {applicationOrigin} from '../../modules/auth/http';
import {storefrontRoot} from '../../modules/shops/domains-validation';

export const dynamic='force-dynamic';

export default async function MerchantSetupPage(){
 const user=await getCurrentUser();
 if(!user)redirect('/connexion/boutique');

 const workspace=await prisma.workspace.findUnique({where:{ownerId:user.userId},select:{id:true}});
 if(!workspace)redirect(user.role==='ADMIN'?'/connexion/admin':'/equipe');
 return <SetupWizard platformOrigin={applicationOrigin()} automaticRoot={process.env.STOREFRONT_DOMAIN_ROUTING==='enabled'?storefrontRoot()||null:null}/>;
}
