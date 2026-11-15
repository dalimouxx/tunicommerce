# Promotions datées (prix barré)

Conception : [specs/2026-11-15-promotions-datees-design.md](superpowers/specs/2026-11-15-promotions-datees-design.md).

## Pour le marchand
Mes boutiques › Catalogue › **Promotions datées** : prix promo, début et fin (heure de Tunis, fin obligatoire). Statuts affichés : *Aucune promotion*, *Programmée*, *En cours*, *Terminée*, *Inactive* (si le prix normal est descendu sous le prix promo). « Arrêter la promotion » rétablit immédiatement le prix normal. Le prix barré doit correspondre à un prix réellement pratiqué avant la promotion.

## Pour l'acheteur
Pendant la période : ancien prix barré, prix promo, badge « −X % », « Jusqu'au … » sur les cartes ; compte à rebours en direct sur la page produit et sur les cartes en thème Souk Flash. Avant le début et après la fin : prix normal, sans action du marchand.

## Règles serveur
- `modules/shops/promotions.ts` : validation (prix inférieur au prix normal, fin après le début et dans le futur), prix en vigueur dans `[startsAt, endsAt)`, conversion de l'heure de Tunis (UTC+1, sans heure d'été).
- `createOrder` facture le prix en vigueur **au moment de la commande**, garde `regularPrice` sur la ligne et ajoute « Promotion : … » à l'historique. Une promo terminée pendant le remplissage du panier est donc facturée au prix normal.
- Les offres de quantité sont recalculées sur le prix promo et ne s'appliquent que si elles sont plus avantageuses ; les coupons s'appliquent ensuite sur le montant réduit.
- Catalogue public : prix en vigueur plus `promotion: {regularPrice, endsAt, percent}` (jamais le coût ni le stock) ; JSON-LD avec `priceValidUntil`.
- API : `GET/POST /api/v1/shops/{shopId}/promotions` (propriétaire uniquement, contrôle d'origine, action idempotente `productPromotion`).

## Vérifications
Tests unitaires (règle de prix, commande, offres, vue marchand, affichage, JSON-LD, liste blanche de sécurité). Recette sur un serveur de production local et une base PostgreSQL jetable : promotion créée via l'API marchand, refus d'un prix trop élevé, d'une fin passée et d'un appel sans session (401) ; vraie commande publique `TC-1049` facturée 2 × 69,000 TND au lieu de 89,000 ; captures FR et AR de la vitrine et de la page produit.

## Limites
L'écran produit de l'ancienne application des boutiques historiques ne propose pas les promotions, mais le serveur les applique. Pas de promotions par catégorie ni de soldes en lot. L'enregistrement par clic dans l'écran marchand n'a pas pu être rejoué en navigateur (protection d'origine du serveur de test) ; l'affichage de l'écran et son refus côté client ont été vérifiés, l'enregistrement l'a été par l'API.
