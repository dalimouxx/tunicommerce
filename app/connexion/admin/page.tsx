import {redirect} from 'next/navigation';
import {getSuperAdminUser} from '../../../modules/auth/session';
import {AuthForm} from '../../../components/auth-form';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},title:'Connexion Super Admin · TuniCommerce'};
export default async function SuperAdminLogin(){
 if(await getSuperAdminUser())redirect('/admin');
 return <AuthForm portal="ADMIN"/>;
}
