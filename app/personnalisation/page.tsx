import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import StoreBrandEditor from './store-brand-editor';
import Link from 'next/link';
import {homeOwner} from '../../modules/shops/home-service';
import styles from '../mes-boutiques/shops.module.css';

export const dynamic='force-dynamic';

export default async function PersonalisationPage(){
 const user=await getCurrentUser();
 if(!user)redirect('/connexion/boutique');

 const workspace=await prisma.workspace.findUnique({where:{ownerId:user.userId},select:{id:true,shop:{select:{id:true}}}});
 if(!workspace)redirect(user.role==='ADMIN'?'/connexion/admin':'/equipe');
 const homeShop=workspace.shop?await homeOwner(user.userId,workspace.shop.id).catch(()=>null):null;
 return <><div className={styles.shell}><section className={styles.card} id="accueil-boutique"><h2>Ma vitrine</h2><p>Modifie les textes et sections de l’accueil de ta boutique existante. Ton catalogue et tes commandes restent dans le même espace.</p>
  {homeShop?<div className={styles.actions}><Link className={styles.primary} href={'/mes-boutiques/'+homeShop.id+'/accueil'}>Composer et publier mon accueil</Link><Link className={styles.secondary} href={'/mes-boutiques/'+homeShop.id+'/accueil/apercu'}>Aperçu du brouillon enregistré</Link></div>:<Link className={styles.secondary} href="/mes-boutiques">Voir mes boutiques accessibles</Link>}
 </section></div><StoreBrandEditor/></>;
}
