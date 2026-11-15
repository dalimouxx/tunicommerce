# Promotions datées (prix barré) — conception

Date : 2026-11-15. Statut : approuvée par le porteur du projet (option 1, « oui c'est bon, vas-y »).

## Intention
Permettre au marchand de lancer une vraie promotion limitée dans le temps : l'ancien prix apparaît barré, avec le pourcentage et un compte à rebours réel. Le prix normal revient seul à la fin de la promotion, sans fausse réduction permanente.

## Approches
1. **Prix promo daté** (retenue) : prix promo, date de début et date de fin obligatoire ; le serveur applique le prix en vigueur à l'instant de la commande.
2. Simple « ancien prix » permanent : écartée, car elle permet les faux prix barrés, n'offre aucun compte à rebours et oblige le marchand à tout remettre à la main.

## Règles
- Une promotion par produit : `{price, startsAt, endsAt}`, stockée dans le produit (JSON existant, sans migration). Le prix promo doit être inférieur au prix normal, la fin postérieure au début et située dans le futur. Le marchand peut l'arrêter à tout moment.
- Saisie à l'heure de Tunis (UTC+1, sans heure d'été), stockage en ISO UTC.
- Prix en vigueur = prix promo si `startsAt ≤ maintenant < endsAt` et prix promo < prix normal ; sinon prix normal.
- La commande (`createOrder`) utilise le prix en vigueur calculé par le serveur ; la ligne garde `regularPrice` et l'historique mentionne « Promotion ».
- Offres de quantité : calculées sur le prix en vigueur, elles ne s'appliquent que si elles sont plus avantageuses. Coupons : appliqués après, sur le montant réduit (règle actuelle).
- Vitrine : prix barré, badge « −X % », « Jusqu'au … » sur les cartes ; compte à rebours en direct sur la page produit et sur les cartes Souk Flash. JSON-LD : prix promo et `priceValidUntil`.
- Interface : Mes boutiques › Catalogue, à côté des offres de quantité. Le serveur applique aussi les promos aux boutiques historiques, sans écran dédié dans ce lot.

## Hors périmètre
Promotions par catégorie ou sur toute la boutique, soldes programmées en lot, écran produit de l'ancienne application.

## Note légale (hors code)
En Tunisie, le prix barré doit correspondre à un prix réellement pratiqué avant la promotion.
