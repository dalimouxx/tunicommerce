import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentUser,getSuperAdminUser} from '../../../modules/auth/session';
import {prisma} from '../../../modules/storage/client';
import {emailConfigured} from '../../../modules/messaging/email';
import {encryptionConfigured} from '../../../modules/security/envelope';
import AccountSecurity from '../../../components/account-security';
export const dynamic='force-dynamic';
export const metadata={title:'Sécurité de mon compte · TuniCommerce',robots:{index:false,follow:false}};
export default async function SecurityPage({searchParams}:{searchParams:Promise<{portail?:string}>}){
 const portal=(await searchParams).portail==='ADMIN'?'ADMIN':'MERCHANT';
 const actor=portal==='ADMIN'?await getSuperAdminUser():await getCurrentUser();
 if(!actor)redirect(portal==='ADMIN'?'/connexion/admin':'/connexion/boutique');
 const user=await prisma.user.findUniqueOrThrow({where:{id:actor.userId},select:{email:true,emailVerifiedAt:true,mfaEnabledAt:true}});
 return <main style={{maxWidth:960,padding:24,margin:'0 auto'}}><Link href={portal==='ADMIN'?'/admin':'/mes-boutiques'}>← Retour à mon espace</Link>
  <h1>Sécurité de mon compte</h1><AccountSecurity email={user.email} verified={!!user.emailVerifiedAt} mfaEnabled={!!user.mfaEnabledAt}
   emailReady={emailConfigured()} mfaReady={encryptionConfigured()} portal={portal}/></main>;
}
