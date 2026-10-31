# Architecture et évolution
React/TypeScript et Vinext pour les écrans. Les composants de présentation (dashboard, statistiques, formulaires, visuels produit) sont séparés du domaine (`modules/commerce`) et du stockage (`modules/storage`).

Le service métier reçoit une copie de l'état et produit le nouvel état. Une écriture D1 conditionnée par la version de l'espace remplace atomiquement l'agrégat complet. En cas de conflit, le serveur relit l'état et réexécute la validation, jusqu'à quatre tentatives. Les modifications de stock, commande, coupon et journal ne sont jamais commises séparément.

L'identité provient des en-têtes authentifiés injectés par Sites, non du corps de la requête. L'espace est sélectionné exclusivement par l'identité. Ne pas héberger ce Worker derrière un proxy public qui laisse le client injecter ces en-têtes.

Évolution nécessaire : normaliser le schéma dans PostgreSQL (Organization, Shop, Membership, Product, Variant, InventoryLedger, Order, OrderLine, PaymentLedger, etc.), ajouter des rôles et le contrôle shopId, séparer les services, mettre les intégrations derrière des adaptateurs et introduire une outbox transactionnelle. Le modèle actuel n'est pas une base de données adaptée à des milliers de marchands actifs.
