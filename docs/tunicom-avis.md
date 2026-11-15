# Avis clients vérifiés

Conception : [specs/2026-11-15-avis-verifies-design.md](superpowers/specs/2026-11-15-avis-verifies-design.md).

## Parcours
1. **Client** : quand sa commande passe à « Livrée », son lien de suivi privé affiche « Donner mon avis » pour chaque produit (note de 1 à 5, commentaire facultatif de 1 000 caractères au plus, sans lien). Un seul avis par commande × produit. Il est publié immédiatement, sous la forme « Prénom I. », avec le badge « Achat vérifié ».
2. **Vitrine** : la page produit affiche la moyenne, le nombre d'avis, les 10 derniers avis publiés et les réponses de la boutique ; les cartes du catalogue affichent « ★ 4,6 (12) ». Google reçoit `aggregateRating` et `review` seulement s'il existe des avis publiés.
3. **Marchand** (Mes boutiques › onglet Clients et croissance › Avis clients) : réponse publique modifiable ; signalement d'un abus (propos injurieux, données personnelles, hors sujet). Un avis signalé est masqué. Le marchand ne peut ni supprimer ni modifier un avis.
4. **Super Admin** (`/admin/avis`) : liste des avis signalés ; « Rétablir » ou « Retirer » ; chaque décision est inscrite au journal d'administration.

## Technique
- Table `ShopReview` (migration additive `202611150001_shop_reviews`) : contrainte d'unicité `(shopId, orderId, productId)`, contrôles SQL sur la note, les longueurs et les statuts. Les droits du compte applicatif VPS sont couverts par les privilèges par défaut.
- `modules/reviews/policy.ts` (validation et règles pures), `modules/reviews/service.ts` (dépôt, lecture, réponse, signalement, arbitrage).
- Routes : `POST /api/v1/public/vitrines/{slug}/suivi/{token}/avis` (origine de la vitrine, aussi autorisée sur un domaine personnalisé), `GET/POST /api/v1/shops/{shopId}/reviews` (propriétaire), `GET/POST /api/admin/reviews` (Super Admin).
- Tous les textes sont affichés échappés par React ; le JSON-LD reste protégé par `jsonLdScript`.

## Vérifications
Tests unitaires (règles, affichage, branchements) et test d'intégration PostgreSQL `tests/reviews-api.test.ts`. Ce dernier couvre : commande non livrée, jeton d'une autre boutique, produit absent de la commande, double envoi, marchand d'une autre boutique, signalement, rétablissement, retrait et journal. Recette sur un serveur de production local avec une base jetable : avis réel déposé via le lien de suivi (201), doublon (200, sans second avis), lien refusé (400), mauvaise origine (403) ; réponse du marchand ; signalement qui masque l'avis ; arbitrage depuis `/admin/avis` ; API admin refusée sans session admin ; captures FR et AR.

## Limites
Pas de photos, pas de modification par le client, pas de notification au marchand lors d'un nouvel avis (à brancher sur l'e-mail ou le SMS plus tard). Les boutiques historiques `/boutiques/…` n'ont pas de page produit, donc pas d'avis.
