import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import SignupForm from './signup-form';

export const dynamic='force-dynamic';
export default async function MerchantSignupPage(){
 const user=await getCurrentUser();
 if(user)redirect('/');
 return <SignupForm/>;
}
