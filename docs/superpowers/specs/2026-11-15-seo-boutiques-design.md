# SEO des boutiques — conception courte

Date : 2026-11-15. Statut : approuvée par le porteur du projet (« D'acc, continuer »).

## Intention
Au lancement, les boutiques doivent être trouvables sur Google et donner un bel aperçu lorsqu'on les partage sur WhatsApp, Facebook ou Instagram, où se fait une grande partie du commerce en Tunisie.

## Approche
Une seule voie raisonnable : les routes de métadonnées natives de Next 16 (`app/robots.ts`, `app/sitemap.ts`, `generateMetadata`), plus deux routes publiques par boutique pour les domaines personnalisés. Le proxy réécrit `/robots.txt` et `/sitemap.xml` de ces domaines vers ces routes. Écartés : un service SEO externe ou des fichiers statiques, incompatibles avec un multi-boutique dynamique.

## Conception
1. **`robots.txt` de la plateforme** : autorise `/`, `/decouvrir`, `/boutiques`, `/vitrines`, `/themes` ; interdit `/admin`, `/api`, `/compte`, `/connexion`, `/mes-boutiques`, `/suivi`, `/equipe`, `/mediatheque`, `/mon-abonnement`, `/personnalisation`, `/demarrage`, `/setup`, `/login`, `/marchand`, `/inscription` ; indique le sitemap.
2. **`sitemap.xml` de la plateforme** : pages publiques de Tunicom, démos de thèmes, vitrines publiées (accueil, produits disponibles, pages publiées) et boutiques indépendantes ouvertes (accueil, pages). Sont exclus : boutiques non publiées, abonnements inactifs ou expirés, catalogues de démonstration (`state.demo`), produits indisponibles et boutiques servies par un domaine personnalisé actif.
3. **Domaines personnalisés** : une boutique dont le domaine est vérifié et routé sert son propre `robots.txt` et son propre `sitemap.xml`, avec des URL sur ce domaine.
4. **URL canonique** : chaque vitrine, produit et boutique indépendante déclare une URL canonique (domaine personnalisé actif, sinon URL Tunicom) et des alternatives `fr`/`ar` (`?lang=ar`).
5. **Images de partage (Open Graph / Twitter)** : photo du produit, sinon bannière ou logo de la boutique, en URL absolue.
6. **Données structurées** : `Product` (nom, description, image, URL, `Offer` avec prix en TND à trois décimales, disponibilité) sur la page produit ; `Store` sur l'accueil d'une vitrine. **Aucune note ni aucun avis** tant que les avis vérifiés n'existent pas.
7. **Sécurité** : JSON-LD sérialisé avec échappement de `<`, `>`, `&`, U+2028 et U+2029, pour qu'un texte de marchand ne puisse pas fermer la balise `<script>`.

## Non-objectifs
Blog et contenu rédactionnel, configuration de Google Search Console, index des pages de suivi ou de commande.

## Calls du constructeur
- Les sous-domaines automatiques ne sont pas canoniques : seuls les domaines personnalisés vérifiés et routés le sont.
- Sitemap limité à 5 000 URL par génération ; au-delà, découpage reporté.
