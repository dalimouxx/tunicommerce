# Phase 02 — catalogue et stock par boutique (pilote)

Cette PR dépend de #17, #16 et #15. Elle ne remplace pas le modèle Workspace existant.

## API boutique indépendante

`GET /api/v1/shops/:shopId/inventory` renvoie les produits de la boutique déjà initialisée, et seulement si le compte est membre OWNER actif.

`POST /api/v1/shops/:shopId/inventory` accepte les actions `product` (ajout ou édition) et `stock` (ajustement). Écrit exclusivement dans ShopCommerce.data via compare-and-swap et version. Requiert session, Origin, rôle OWNER actif, requestId UUID et un espace créé explicitement. La même requête ne peut pas modifier deux fois les données. Aucune mutation du Workspace historique.

La validation du catalogue et des stocks réutilise le moteur existant. Les plafonds produits existants de l'abonnement du compte propriétaire sont vérifiés pour chaque nouvelle boutique ; un plafond pilote supplémentaire de 20 produits par boutique limite le risque tant que le comptage global des multi-boutiques n'est pas développé. Les images de bibliothèque historique sont refusées. Les liens HTTPS sont possibles.

**Limites importantes** : ce quota est appliqué par boutique, pas encore sur le total de boutiques d'une organisation ; la limite maxShops, les modules SaaS, les échéances et les quotas globaux restent à implémenter. Ce pilote ne doit pas être commercialisé comme gestion multi-boutique complète. Aucun checkout client ou paiement n'utilise encore ShopCommerce.

Avant fusion : vérifier les tests HTTP sur PostgreSQL de 2 utilisateurs / 2 boutiques, renouvellements simultanés, absence de fuite, restrictions de plan et images, migration avec sauvegarde Neon.
