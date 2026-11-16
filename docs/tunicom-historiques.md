# Journal et mouvements de stock hors du bloc JSON

Conception : [specs/2026-11-16-historiques-hors-json-design.md](superpowers/specs/2026-11-16-historiques-hors-json-design.md). Étape 1 du chantier « vraies tables ».

## Pourquoi
Chaque action d'un marchand réécrit tout le bloc JSON de sa boutique. Le journal d'activité (environ six lignes par commande) et les mouvements de stock ne faisaient que grossir. Gain mesuré sur une simulation de 1 000 commandes : **2,07 Mo → 1,29 Mo (−38 %)** réécrits à chaque action, et ces historiques cessent de grossir.

## Fonctionnement
- Tables `CommerceJournalEntry` et `CommerceStockMovement` (migration additive `202611160002_commerce_history`), identifiées par la source (`SHOP` ou `WORKSPACE`) et l'identifiant d'origine de chaque entrée.
- Dans les sept chemins qui enregistrent le bloc (écritures marchandes vitrines et historiques, checkouts publics, demandes client, confirmation client, suivi historique) : la fenêtre courante est insérée sans doublon, puis le bloc ne garde que les **200** entrées les plus récentes de chaque historique, dans la même transaction.
- Aucune logique métier ne change : le stock reste porté par le produit ; les écrans affichaient déjà au plus 100 lignes du journal et 30 mouvements.
- Historique complet : export CSV par le **propriétaire** — `GET /api/v1/shops/{shopId}/history?kind=journal` ou `kind=movements` (formules neutralisées, quantités numériques).

## Au déploiement
Après la migration, lancer une fois :

```bash
npm run history:offload
```

Ce rattrapage, idempotent, copie les historiques existants et allège les blocs, sous le même verrou et avec le même contrôle de version que les écritures. Il peut être relancé sans risque.

## Vérifications
- Tests unitaires de la séparation.
- Test d'intégration PostgreSQL `tests/history-offload-api.test.ts` : aucune perte, aucun doublon, fenêtre respectée après une vraie écriture marchande, stock et commandes identiques, rattrapage idempotent, export CSV.
- Suites rejouées : `postgres`, `order-confirmation-api`, `reliability-api`, `reviews-api`, `platform-route-audit`, `merchant-shop-journey-api`, `order-mail-api`.

## Étape suivante
Archivage des commandes terminées : 57 % du bloc et 70 fichiers lecteurs. Chantier séparé, avec sa propre conception.
