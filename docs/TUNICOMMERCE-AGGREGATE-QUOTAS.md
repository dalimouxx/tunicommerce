# Étape 02 — quotas agrégés marchands (pilote sécurisé)

Cette PR dépend de #19 → #18 → #17 → #16 → #15. Aucune écriture sur les anciennes données commerciales.

Les nouvelles mutations `product` et `createOrder` calculent les quotas `maxProducts` et `maxOrdersPerMonth` sur la somme de :
1. l'ancien Workspace du marchand (une seule fois) ;
2. les données de toutes les nouvelles boutiques ShopCommerce dont il est OWNER actif ;
3. le nouvel état de la boutique modifiée.

Elles prennent un verrou transactionnel PostgreSQL par marchand pour sérialiser les écritures venant des **nouvelles** APIs. Les requêtes sont idempotentes grâce au requestId et utilisent une version optimiste. Les produits et commandes supprimés ou les mises à jour qui ne créent pas de nouvelles ressources ne sont pas pénalisés.

## Limites avant lancement commercial
- Les modifications via l'ancien endpoint `/api/commerce` ne participent pas au même verrou inter-boutique. Cela laisse une course possible lorsqu'un ancien Workspace et une nouvelle boutique sont modifiés simultanément. Il faut aligner les deux chemins ou choisir un compteur central transactionnel.
- L'offre et les exceptions sont encore adossées au Workspace historique du propriétaire ; un marchand sans Workspace de facturation ne peut pas utiliser les écritures des nouvelles boutiques (échec sécurisé).
- `maxShops`, droits fins des collaborateurs, limites des médias, expiration et renouvellement de l'abonnement, ainsi que modèles commerciaux SaaS multi-tenant restent à finaliser.
- Les limitations pilotes par boutique de 20 produits et 10 commandes mensuelles restent actives.
- Une sauvegarde Neon et des tests d'intégration de concurrence sur une vraie base PostgreSQL sont nécessaires avant fusion sur main et déploiement Render.

Ce développement ne doit pas être présenté comme une facturation SaaS multi-boutiques prête pour production.
