import {notFound} from 'next/navigation';
import {prisma} from '../../modules/storage/client';
import {AuthForm} from '../../components/auth-form';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Setup(){
 if(await prisma.setupLock.findUnique({where:{id:1},select:{id:true}}))notFound();
 return <AuthForm setup/>;
}
