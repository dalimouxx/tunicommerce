import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import SignupForm from './signup-form';
import {applicationOrigin} from '../../modules/auth/http';
import {storefrontRoot} from '../../modules/shops/domains-validation';

export const dynamic='force-dynamic';
export default async function MerchantSignupPage(){
 const user=await getCurrentUser();
 if(user)redirect('/');
 return <SignupForm platformOrigin={applicationOrigin()} automaticRoot={process.env.STOREFRONT_DOMAIN_ROUTING==='enabled'?storefrontRoot()||null:null}/>;
}
