# Étape 02 — commandes privées indépendantes (pilote)

PR dépendante de #18 et #17, qui dépendent de #16 et #15.

- `GET /api/v1/shops/{shopId}/orders` lit uniquement les commandes de ShopCommerce pour le OWNER actif, pas celles du Workspace historique.
- `POST /api/v1/shops/{shopId}/orders` : createOrder, transition, note, avec schémas métier, stock réservé, idempotence UUID et transaction optimiste versionnée. Le owner doit avoir un workspace de facturation existant permettant le contrôle des quotas. Les autres comptes échouent de façon sécurisée.
- Plafond provisoire de 10 commandes/mois/nouvelle boutique, en supplément des limites SaaS existantes.
- Aucun checkout public / SMS / WhatsApp / remboursement / encaissement COD activé par ce pilote. Pas de diffusion des informations clients à un rôle d'équipe sans autorisation.

Attention : quotas actuellement évalués par boutique au moyen du plan Workspace propriétaire, non agrégés entre ses boutiques. Avant commercialisation, implémenter un vrai billing multi-boutique, les plafonds globaux, et tester une restauration Neon.

Contrôles indispensables avant merge : tests de création et d'isolement multi-utilisateurs, rejet des rôles non autorisés, contrôles de transitions et de stock, intégrité des requêtes concurrentes et migration sur DB de test.
