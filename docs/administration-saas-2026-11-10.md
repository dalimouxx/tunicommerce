# TuniCommerce — administration SaaS et abonnements

## Livraison du 10 novembre 2026

Priorité choisie : administration SaaS et abonnements.

- Dans `/admin/abonnements/complet`, filtrer par offre et anticiper les échéances à 7, 14 ou 30 jours. La recherche, la pagination et l'export CSV utilisent les mêmes critères côté serveur.
- Les offres désactivées restent consultables pour suivre les comptes existants. Un code historique transmis par URL reste sélectionnable même si l'offre n'existe plus au catalogue.
- Une échéance exactement atteinte est expirée. Une échéance exactement à la limite de l'horizon est proche. Les comptes suspendus et résiliés restent séparés. Ces filtres n'accordent aucun accès supplémentaire et ne modifient aucun abonnement.
- Le tableau rapide utilise désormais la classification centrale : un statut inconnu avec une date future ne peut plus apparaître comme valide.
- La navigation entre catalogue, fiche produit et panier conserve explicitement le français ou l'arabe, même sans cookies. Les liens de langue remplacent l'ancien paramètre et préservent les ancres et les références produit.
- Next.js passe de 16.3.4 à 16.4.6. Les alertes critiques npm liées à Next.js disparaissent après installation.

## Vérification

`npm test` découvre les tests unitaires automatiquement : 93 fichiers, 315 tests réussis. Les tests unitaires ne reçoivent pas les variables de connexion PostgreSQL.

`npm run typecheck` et `npm run build` passent sur la version finale (Node.js 24, Next.js 16.4.6, Prisma 6.19.0).

`npm run test:integration` conserve le parcours PostgreSQL historique. `npm run test:integration:all` exécute les 17 suites PostgreSQL/HTTP en série afin d'éviter leurs effacements concurrents de tables. Cette commande exige `DATABASE_URL` et `TEST_DATABASE_URL` identiques, sur une base jetable dont le nom se termine par `_test`. L'exercice de restauration, qui exige une sauvegarde préparée et une phase explicite, reste dans son workflow dédié.

Les tests PostgreSQL/HTTP et la recette visuelle de l'administration authentifiée n'ont pas été exécutés localement pour cette livraison. Les tests unitaires ne prouvent pas ces parcours.

## Suite proposée pour l'administration SaaS

1. Renouvellement : relier chaque prolongation à un paiement vérifié, afficher l'historique et gérer les changements d'offre avec une politique explicite de dates et de quotas.
2. Pilotage : distinguer les paiements encaissés, les déclarations en attente et les montants attendus ; proposer une vue par mois et par offre.
3. Support marchand : récupération de mot de passe et notifications transactionnelles après choix et configuration du prestataire e-mail.
4. Validation : recette avec plusieurs marchands et plusieurs boutiques, droits d'accès, paiement déclaré puis approuvé, expiration et réactivation.

La facturation et les règlements restent manuels. Aucun prélèvement, envoi de message, changement de base, fusion sur `main` ou déploiement n'est inclus dans ce lot.

## Dépendances à traiter ensuite

L'audit npm signale encore cinq entrées de sévérité élevée : Zod et la chaîne d'outils Prisma (`prisma`, `@prisma/config`, `effect`, `deepmerge-ts`). Les correctifs proposés impliquent des changements de version majeure ; prévoir une migration dédiée avec validation des schémas et des migrations PostgreSQL. Le dépôt n'est donc pas présenté comme exempt de vulnérabilités ni prêt au lancement commercial.
