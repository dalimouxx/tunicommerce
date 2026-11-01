import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../../modules/auth/session';
import CustomerAuth from '../../../components/customer-auth';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Page(){const user=await getCurrentUser();if(user)redirect(user.role==='CUSTOMER'?'/compte':'/');return <CustomerAuth/>;}
