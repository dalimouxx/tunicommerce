import Link from 'next/link';

/** French 404 for any other missing page (replaces Next.js's default English message). */
export default function NotFound() {
 return <main className="platform">
  <section className="platform-hero">
   <span className="eyebrow">PAGE INTROUVABLE</span>
   <h1>Cette page n’existe pas ou plus</h1>
   <p>Vérifiez l’adresse, ou repartez de l’accueil.</p>
   <p><Link className="primary" href="/">Accueil Tunicom</Link>{' '}<Link className="button" href="/boutiques">Voir les boutiques</Link></p>
  </section>
 </main>;
}
