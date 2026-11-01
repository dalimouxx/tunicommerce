import {redirect} from 'next/navigation';
import {getCurrentUser} from '../modules/auth/session';
import {prisma} from '../modules/storage/client';
import CommerceApp from '../components/commerce-app';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getCurrentUser();if(!user)redirect('/login');if(user.role==='CUSTOMER')redirect('/compte');const shop=await prisma.workspace.findUnique({where:{ownerId:user.userId},select:{slug:true}});return <CommerceApp admin={user.role==='ADMIN'} shopSlug={shop?.slug}/>;}
