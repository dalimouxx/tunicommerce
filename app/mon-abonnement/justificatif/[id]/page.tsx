import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {getCurrentUser} from '../../../../modules/auth/session';
import {prisma} from '../../../../modules/storage/client';
import {paymentMethodLabel,paymentStatusLabel,toTnd} from '../../../../modules/billing/validation';
import PrintButton from './print-button';
import styles from './document.module.css';

export const dynamic='force-dynamic';

export default async function SubscriptionPaymentDocument({
 params
}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser();
 if(!user)redirect('/connexion/boutique');
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const payment=await prisma.subscriptionPayment.findFirst({
  where:{id,workspace:{ownerId:user.userId}},
  include:{workspace:{select:{slug:true,owner:{select:{name:true,email:true}}}}}
 });
 if(!payment)notFound();
 const approved=payment.status==='APPROVED';
 return <main className={styles.body}>
  <div className={styles.toolbar}>
   <Link href="/mon-abonnement">← Mon abonnement</Link>
   <PrintButton/>
  </div>
  <article className={styles.paper}>
   <header className={styles.header}>
    <div>
     <span className={styles.brand}>Tunicom</span>
     <h1>{approved?'Attestation de validation administrative':'Déclaration de règlement SaaS'}</h1>
     <p>Document informatif interne — ne constitue pas une facture fiscale, ni un justificatif émis par D17 ou une banque.</p>
    </div>
    <span className={approved?styles.validated:styles.pending}>{paymentStatusLabel(payment.status)}</span>
   </header>
   <section className={styles.section}>
    <div><small>Référence du dossier</small><strong>{payment.reference}</strong></div>
    <div><small>Date de déclaration</small><strong>{payment.createdAt.toLocaleString('fr-TN')}</strong></div>
    <div><small>Commerçant</small><strong>{payment.workspace.owner.name}</strong><span>{payment.workspace.owner.email}</span></div>
    <div><small>Boutique</small><strong>{payment.workspace.slug||'Boutique sans URL'}</strong></div>
   </section>
   <table className={styles.table}>
    <thead><tr><th>Service SaaS demandé</th><th>Durée</th><th>Montant de référence</th></tr></thead>
    <tbody><tr><td>{payment.planName} ({payment.planCode})</td><td>{payment.durationDays} jours</td><td>{toTnd(payment.priceMillimes)}</td></tr></tbody>
   </table>
   <section className={styles.section}>
    <div><small>Méthode déclarée</small><strong>{paymentMethodLabel(payment.method)}</strong></div>
    <div><small>Référence externe déclarée</small><strong>{payment.transferReference||'Remise en espèces annoncée'}</strong></div>
    <div><small>Décision de l'administration</small><strong>{paymentStatusLabel(payment.status)}</strong></div>
    <div><small>Date de décision</small><strong>{payment.decidedAt?.toLocaleString('fr-TN')||'En attente'}</strong></div>
    {approved&&payment.periodStartsAt&&<div><small>Début de la période créditée</small><strong>{payment.periodStartsAt.toLocaleDateString('fr-TN')}</strong></div>}
    {approved&&payment.periodEndsAt&&<div><small>Fin de la période créditée</small><strong>{payment.periodEndsAt.toLocaleDateString('fr-TN')}</strong></div>}
   </section>
   {payment.adminNote&&<p className={styles.note}><strong>Note administrative :</strong> {payment.adminNote}</p>}
   <footer className={styles.footer}>
    <p>{approved
      ?'L’administration Tunicom a enregistré et validé manuellement cette déclaration. Cette attestation ne remplace pas une facture fiscale ni le justificatif original de transfert.'
      :'Cette demande a été déclarée par le commerçant. La réception effective des fonds n’est pas établie par ce document et aucun abonnement n’est prolongé tant que la déclaration n’est pas approuvée.'}</p>
    <p>Pour une facture légale, les coordonnées fiscales de l’émetteur, les mentions légales, les taxes applicables et une numérotation réglementaire doivent être configurées.</p>
   </footer>
  </article>
 </main>;
}
