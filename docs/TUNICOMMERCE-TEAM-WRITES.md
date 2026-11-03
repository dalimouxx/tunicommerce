# Étape 02 — premières actions d'équipe, en pilote

- Une API séparée POST /api/v1/shops/{shopId}/team-actions, sans aucune réponse contenant les informations commerciales complètes.
- Une session active, Origin vérifié, rôle Membership actif, boutique non historique, validation Zod stricte, idempotence UUID et contrôle transactionnel des quotas du propriétaire sont requis.
- Magasinier (STOCK) : uniquement ajustement des stocks avec motif.
- Agent (CALL_CENTER) : confirmation, sans réponse ou rappel futur pour les commandes en attente ; note de confirmation. Aucun statut d'expédition, aucune annulation, aucun encaissement.
- Réutilisation de la transaction de ShopCommerce, du verrou du propriétaire de l'organisation et de la version optimiste, avec journal d'audit contenant l'identifiant de l'acteur dans l'état commercial.
- Un comptable (ACCOUNTANT) reste volontairement en lecture seule ; encaissements COD et opérations financières nécessitent un modèle d'audit et de rapprochement dédié.

**Limitations importantes** : accès propriétaire existant et ancien Workspace inchangés ; les nouvelles boutiques ne sont pas encore publiées, et le contrôle des limites globales peut entrer en concurrence avec l'ancien endpoint. Échéances d'abonnement et quotas maxShops à sécuriser avant commercialisation. PR dédiée ; ne pas déployer sans vérification CI et tests HTTP de révocation et d'isolement.
