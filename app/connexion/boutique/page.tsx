import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../../modules/auth/session';
import {AuthForm} from '../../../components/auth-form';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},title:'Connexion Boutique · TuniCommerce'};
export default async function BoutiqueLogin(){
 if(await getCurrentUser())redirect('/mes-boutiques');
 return <AuthForm portal="MERCHANT"/>;
}
