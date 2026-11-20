import Link from 'next/link';

/** 404 of a public shop address: same page whether the shop does not exist, is unpublished or its subscription lapsed. */
export default function StorefrontUnavailable() {
 return <main className="platform">
  <header><a href="/boutiques">← Toutes les boutiques</a><span>Paiement à la livraison</span></header>
  <section className="platform-hero">
   <span className="eyebrow">BOUTIQUE INDISPONIBLE</span>
   <h1>Cette boutique n’est pas accessible pour le moment</h1>
   <p>L’adresse est peut-être incorrecte, ou la boutique n’est pas encore ouverte au public.</p>
  </section>
  <section className="card shop-tile">
   <h2>Vous êtes le marchand ?</h2>
   <p>Une boutique n’est visible que lorsqu’elle est <strong>publiée</strong> et que son <strong>abonnement est actif</strong> (essai en cours ou abonnement payé).</p>
   <p>
    <Link className="primary" href="/mes-boutiques">Ouvrir mon espace</Link>{' '}
    <Link className="button" href="/mon-abonnement">Voir mon abonnement</Link>
   </p>
  </section>
 </main>;
}
