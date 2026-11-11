import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {domainOverview} from '../../../../modules/shops/domains-service';
import {HttpError} from '../../../../modules/auth/http';
import DomainManager from './domain-manager';
import styles from '../../shops.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Domaines de ma boutique · Tunicom',robots:{index:false,follow:false}};
export default async function DomainsPage({params}:{params:Promise<{shopId:string}>}){
 const actor=await getCurrentUser();if(!actor)redirect('/connexion/boutique');const {shopId}=await params;
 let initial;try{initial=await domainOverview(actor.userId,shopId);}catch(error){if(error instanceof HttpError)notFound();throw error;}
 return <main className={styles.shell}><div className={styles.content}><header className={styles.header}><div><span className={styles.eyebrow}>TON NOM. TON ADRESSE.</span><h1>Les domaines de ta boutique</h1><p>Prépare ton sous-domaine et connecte une adresse personnelle dont tu possèdes le DNS.</p></div><Link className={styles.back} href={'/mes-boutiques/'+encodeURIComponent(shopId)}>Ma boutique</Link></header><DomainManager shopId={shopId} initial={initial}/></div></main>;
}
