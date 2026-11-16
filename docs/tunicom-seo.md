# SEO des boutiques

Conception : [specs/2026-11-15-seo-boutiques-design.md](superpowers/specs/2026-11-15-seo-boutiques-design.md).

## Ce que voit Google
- `https://<APP_URL>/robots.txt` : autorise les vitrines, boutiques, démos et la landing ; interdit les espaces privés et l'API ; indique le sitemap.
- `https://<APP_URL>/sitemap.xml` : pages publiques de Tunicom, démos de thèmes, vitrines publiées (accueil, produits disponibles, pages publiées) et boutiques indépendantes ouvertes. Exclus : boutiques non publiées ou à l'abonnement inactif, catalogues de démonstration, produits indisponibles, boutiques servies par leur propre domaine.
- Domaine personnalisé actif : `/robots.txt` et `/sitemap.xml` du domaine sont réécrits par le proxy vers `/api/v1/public/seo/{slug}/robots|sitemap`, avec des URL sur ce domaine. Sans domaine routé, ces routes répondent 404.

## Sur chaque page de boutique
- URL canonique (domaine personnalisé actif, sinon Tunicom) et alternatives `fr` / `ar` (`?lang=ar`).
- Open Graph et Twitter : photo du produit, sinon bannière, logo ou première photo de la boutique (aperçu WhatsApp, Facebook, Instagram).
- JSON-LD : `Product` avec une offre en TND (trois décimales) et la disponibilité réelle sur la page produit ; `Store` sur l'accueil. Aucune note ni aucun avis tant que les avis vérifiés n'existent pas.
- Les catalogues de démonstration sont `noindex`.
- Le JSON-LD échappe `<`, `>`, `&`, U+2028 et U+2029 : un texte de marchand ne peut pas fermer la balise `<script>`.

## Code
`modules/seo/urls.ts`, `structured-data.ts`, `sitemap.ts` (fonctions pures testées), `canonical.ts` (chargement Prisma et origine canonique), `app/robots.ts`, `app/sitemap.ts`, `app/api/v1/public/seo/[slug]/*`, règle `/robots.txt` et `/sitemap.xml` dans `modules/shops/domain-path-policy.ts`.

## Après la mise en ligne (à faire par l'exploitant)
Déclarer le domaine dans Google Search Console et y soumettre `/sitemap.xml`. Les marchands ayant leur domaine peuvent faire de même pour le leur.

## Limites
Au-delà de 5 000 URL, le sitemap est tronqué : un découpage sera nécessaire. Le parcours complet sur un vrai domaine personnalisé (DNS, HTTPS, proxy) n'a été vérifié que par tests unitaires de la règle de routage, pas sur un VPS réel.
