import AccountRecovery from '../../../components/account-recovery';
import {emailConfigured} from '../../../modules/messaging/email';
export const dynamic='force-dynamic';
export const metadata={title:'Récupérer mon accès · Tunicom',robots:{index:false,follow:false}};
export default async function RecoveryPage({searchParams}:{searchParams:Promise<{portail?:string}>}){
 const query=await searchParams;
 return <AccountRecovery mode="request" ready={emailConfigured()} portal={query.portail==='ADMIN'?'ADMIN':'MERCHANT'}/>;
}
