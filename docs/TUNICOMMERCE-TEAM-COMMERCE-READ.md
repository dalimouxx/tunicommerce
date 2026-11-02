# Étape 02 — accès lecture par rôles aux nouvelles boutiques

PR dépendante de #20 → #19 → #18 → #17 → #16 → #15.

Un propriétaire OWNER conserve ses outils de gestion. Les collaborateurs actifs des nouvelles boutiques peuvent consulter via `GET /api/v1/shops/{shopId}/team-view?section=products|orders|finance` des projections strictement limitées par `ShopPermission` :
- STOCK : produits, quantités et commandes expurgées des informations acheteur ;
- CALL_CENTER : commandes et nom/téléphone/gouvernorat de l'acheteur pour confirmer (pas d'adresse complète ni montants) ;
- ACCOUNTANT : données financières agrégées, sans contact clients ;
- VIEWER : commandes sans contact ni montants, et produits ;
- DELIVERY_MANAGER/MANAGER/OWNER : selon les droits précis du module permissions.

Aucun tableau de bord ou API ne donne accès au Workspace historique d'un autre utilisateur. Les accès sont contrôlés pour la session, le shopId, l'appartenance active, la rubrique demandée et l'absence de lien historique **avant** la lecture du JSON de ShopCommerce.

Limitation volontaire : L'API équipe est en lecture seule. Les mutations stock/commandes restent réservées au OWNER actif ; les permissions d'écriture équipe et l'audit seront une PR suivante après tests de limites SaaS et sérialisation. Les anciennes boutiques ne bénéficient pas de cette nouvelle API. L'accès aux contacts clients est prévu pour les rôles nécessitant `customers.read`.

Tests unitaires de projection et tests HTTP authentifiés recommandés avant fusion; vérifier les contrôles croisés multi-marchands et la révocation active.
