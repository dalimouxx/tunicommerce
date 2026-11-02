# Étape 02 — lectures commerciales protégées par rôle (pilote)

PR dépendante de #20 → #19 → #18 → #17 → #16 → #15.

Le module autorise désormais la **lecture** des catalogues et des commandes des nouvelles boutiques isolées par les collaborateurs ayant un membership **actif** et une permission correspondante de la matrice `modules/shops/permissions.ts`.

- `GET /api/v1/shops/:shopId/inventory` : les rôles disposant de `products.read` peuvent voir les produits ; les coûts d'achat sont masqués pour STOCK, CALL_CENTER et VIEWER.
- `GET /api/v1/shops/:shopId/orders` : les rôles `orders.read` obtiennent leurs commandes ; les données personnelles, notes, signaux de risque et coûts sont masqués pour STOCK, ACCOUNTANT et VIEWER. Les rôles CALL_CENTER et DELIVERY_MANAGER gardent les données client requises pour leur travail.
- Boutiques historiques liées à Workspace : aucun nouvel accès commercial d'équipe. Pas de découverte d'une boutique sans membership.
- POST produit/stock/commande : **OWNER uniquement**, inchangé. Ne pas utiliser les permissions de lecture pour autoriser les mutations.
- Les réponses filtrées ne contiennent jamais l'objet State complet, la liste globale de clients, ni les compteurs d'abonnement.

Ce travail **ne finalise pas les droits d'édition des employés** ni le nouveau tableau de bord équipe : ces modules réclament des autorisations serveur transactionnelles, des tests de concurrence et une UI dédiée.

Éviter le déploiement tant que les PR dépendantes, quotas globaux et tests PostgreSQL de non-divulgation ne sont pas validés.
