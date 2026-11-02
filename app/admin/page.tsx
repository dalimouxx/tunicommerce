import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ShieldCheck,Store,Users,Globe,Plus,ArrowUpRight,Layers,ExternalLink,Settings2} from 'lucide-react';
import {getCurrentUser} from '../../modules/auth/session';
import {prisma} from '../../modules/storage/client';
import {isOpen} from '../../modules/platform/public';
import styles from './platform.module.css';

export const dynamic='force-dynamic';

function legacyName(data:unknown):string{
 if(!data||typeof data!=='object'||Array.isArray(data))return 'Boutique sans nom';
 const shop=(data as Record<string,unknown>).shop;
 if(!shop||typeof shop!=='object'||Array.isArray(shop))return 'Boutique sans nom';
 const name=(shop as Record<string,unknown>).name;
 return typeof name==='string'&&name.trim()?name.trim():'Boutique sans nom';
}

export default async function GlobalAdministration(){
 const user=await getCurrentUser();
 if(!user)redirect('/login');
 if(user.role!=='ADMIN')redirect('/marchand');

 const [merchantCount,workspaces,relationalShops,organizationCount]=await Promise.all([
  prisma.user.count({where:{role:'MERCHANT'}}),
  prisma.workspace.findMany({
   
   select:{
    id:true,ownerId:true,slug:true,data:true,published:true,subscriptionStatus:true,
    subscriptionEndsAt:true,plan:true,owner:{select:{name:true,email:true,role:true}},
    updatedAt:true
   },
   orderBy:{updatedAt:'desc'},take:200
  }),
  prisma.shop.findMany({
   select:{
    id:true,name:true,slug:true,status:true,legacyWorkspaceId:true,
    organization:{select:{name:true,owner:{select:{name:true,email:true}}}}
   },
   orderBy:{updatedAt:'desc'},take:200
  }),
  prisma.organization.count()
 ]);
 const newShops=relationalShops.filter(shop=>!shop.legacyWorkspaceId);
 const linked=new Set(relationalShops.map(shop=>shop.legacyWorkspaceId).filter(Boolean));
 const ownWorkspace=workspaces.find(row=>row.ownerId===user.userId);
 const live=workspaces.filter(row=>isOpen(row)).length;
 const total=workspaces.length+newShops.length;

 return <div className={styles.shell}>
  <aside className={styles.sidebar}>
   <Link href="/admin" className={styles.logo}><span className={styles.logoIcon}><Layers size={20}/></span><span>TuniCommerce<small>Console plateforme</small></span></Link>
   <div className={styles.sectionLabel}>ADMINISTRATION GLOBALE</div>
   <nav className={styles.navigation} aria-label="Navigation super-administrateur">
    <Link className={styles.active} href="/admin"><ShieldCheck size={18}/> Vue d’ensemble</Link>
    <Link href="/admin/gestion-boutiques"><Store size={18}/> Gérer les boutiques</Link>
    <Link href="/boutiques"><Globe size={18}/> Boutiques publiques</Link>
    {ownWorkspace&&<Link href="/marchand"><Store size={18}/> Ma boutique personnelle</Link>}
   </nav>
   <div className={styles.identity}><span className={styles.identityIcon}><ShieldCheck size={19}/></span><div><strong>Super-administrateur</strong><small>{user.email}</small></div></div>
  </aside>

  <main className={styles.main}>
   <header className={styles.top}>
    <span className={styles.breadcrumb}>TuniCommerce / <strong>Administration globale</strong></span>
    <span className={styles.security}><ShieldCheck size={15}/> Accès plateforme sécurisé</span>
   </header>
   <div className={styles.content}>
    <div className={styles.head}>
     <div><span className={styles.eyebrow}>CENTRE DE CONTRÔLE DE TUNICOMMERCE</span><h1>Administration globale</h1>
      <p>Gérez l’ensemble des commerçants, des boutiques, de leur publication et de leurs abonnements. Cet espace n’est pas le tableau de bord d’une boutique.</p></div>
     <Link href="/admin/gestion-boutiques" className={styles.primary}><Plus size={18}/> Créer ou gérer une boutique</Link>
    </div>

    <div className={styles.stats}>
     <div className={styles.stat}><span><Users size={17}/> Marchands inscrits</span><strong>{merchantCount}</strong><small>Comptes marchands</small></div>
     <div className={styles.stat}><span><Store size={17}/> Boutiques</span><strong>{total}</strong><small>{workspaces.length} historiques (dont {workspaces.filter(s=>s.owner.role==='ADMIN').length} plateforme) · {newShops.length} nouvelles</small></div>
     <div className={styles.stat}><span><Globe size={17}/> Boutiques accessibles</span><strong>{live}</strong><small>Publiées avec abonnement valide</small></div>
     <div className={styles.stat}><span><Layers size={17}/> Organisations</span><strong>{organizationCount}</strong><small>Structure multi-boutique</small></div>
    </div>

    <section className={styles.panel}>
     <div className={styles.panelHead}><div><h2>Boutiques de la plateforme</h2><p>Une vue globale des boutiques de tous les marchands, sans exposer leurs données privées.</p></div><Link href="/admin/gestion-boutiques" className={styles.secondary}><Settings2 size={16}/> Gestion et abonnements</Link></div>
     <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>Boutique</th><th>Propriétaire</th><th>Type</th><th>Statut</th><th>Action</th></tr></thead>
      <tbody>
       {workspaces.map(s=><tr key={'w-'+s.id}>
        <td><strong>{legacyName(s.data)}</strong><small>{s.slug?'/boutiques/'+s.slug:'Lien non configuré'}</small></td>
        <td>{s.owner.name}<small>{s.owner.email}</small></td>
        <td><span className={styles.tag}>{s.owner.role==='ADMIN'?'Boutique historique du compte plateforme':'Boutique marchande'}{linked.has(s.id)?' · Équipe reliée':''}</span></td>
        <td><span className={isOpen(s)?styles.success:styles.waiting}>{isOpen(s)?'Publiée':'Non publiée'}</span><small>{s.plan} · {s.subscriptionStatus}</small></td>
        <td><Link href="/admin/gestion-boutiques" className={styles.action}>Gérer <ArrowUpRight size={14}/></Link>
         {s.slug&&isOpen(s)&&<Link href={'/boutiques/'+s.slug} className={styles.action}>Voir <ExternalLink size={14}/></Link>}</td>
       </tr>)}
       {newShops.map(s=><tr key={'n-'+s.id}>
        <td><strong>{s.name}</strong><small>{s.slug}</small></td>
        <td>{s.organization.owner.name}<small>{s.organization.owner.email}</small></td>
        <td><span className={styles.tag}>Nouvelle structure</span></td>
        <td><span className={styles.waiting}>{s.status==='DRAFT'?'Brouillon':s.status}</span><small>{s.organization.name}</small></td>
        <td><span className={styles.notReady}>Publication à connecter</span></td>
       </tr>)}
      </tbody>
     </table></div>
     {total===0&&<div className={styles.empty}><Store size={31}/><strong>Aucune boutique marchande pour le moment</strong><p>Aucune boutique existante ou nouvelle. Ajoutez un marchand pour démarrer la plateforme.</p><Link className={styles.primary} href="/admin/gestion-boutiques"><Plus size={17}/> Créer une boutique</Link></div>}
    </section>

    <div className={styles.infoGrid}>
     <Link className={styles.infoCard} href="/admin/gestion-boutiques"><Settings2 size={22}/><strong>Gestion centrale</strong><span>Créer des marchands, configurer les boutiques, leurs liens publics, leurs offres et leurs abonnements.</span><ArrowUpRight size={17}/></Link>
     <Link className={styles.infoCard} href="/boutiques"><Globe size={22}/><strong>Vue des acheteurs</strong><span>Consulter uniquement les boutiques publiées visibles par les clients, sans connexion.</span><ArrowUpRight size={17}/></Link>
     {ownWorkspace?<Link className={styles.infoCard} href="/marchand"><Store size={22}/><strong>Gérer ma boutique personnelle</strong><span>Accédez aux produits, commandes, clients, stocks et visuels de la boutique qui appartient à votre compte, sans modifier les autres marchands.</span><ArrowUpRight size={17}/></Link>:
     <div className={styles.infoCard}><Users size={22}/><strong>Espace des marchands</strong><span>Chaque marchand utilise son tableau de bord privé à l’adresse /marchand. Seuls les propriétaires peuvent y accéder.</span><span className={styles.tag}>Espaces séparés</span></div>}
    </div>
   </div>
  </main>
 </div>;
}
