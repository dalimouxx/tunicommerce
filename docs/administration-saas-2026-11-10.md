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

`npm test` découvre les tests unitaires automatiquement : 95 fichiers, 320 tests réussis. Les tests unitaires ne reçoivent pas les variables de connexion PostgreSQL.

`npm run typecheck` et `npm run build` passent sur la version finale (Node.js 24, Next.js 16.4.6, Prisma 6.19.0).

`npm run test:integration` conserve le parcours PostgreSQL historique. `npm run test:integration:all` exécute les 17 suites PostgreSQL/HTTP en série afin d'éviter leurs effacements concurrents de tables. Cette commande exige `DATABASE_URL` et `TEST_DATABASE_URL` identiques, sur une base jetable dont le nom se termine par `_test`. L'exercice de restauration, qui exige une sauvegarde préparée et une phase explicite, reste dans son workflow dédié.

Les deux suites PostgreSQL/HTTP `saas-billing-api.test.ts` et `payment-reception-api.test.ts` ont été exécutées localement : 20 tests réussis sur PostgreSQL 18, dans une base jetable séparée de toute base existante. Les 15 autres suites d'intégration n'ont pas été exécutées localement. La recette visuelle interactive de l'administration reste à effectuer.

## Deuxième lot — vérification des règlements et renouvellements

- `/admin/paiements` recherche et filtre directement en base par décision, moyen et texte (marchand, référence, offre ou boutique). Les dossiers sont paginés par 50, du plus ancien au plus récent. Le filtre par défaut affiche les dossiers à vérifier, même s'ils sont plus anciens que les 200 dernières déclarations.
- L'export de la page conserve tous les critères et le même ordre. Les exports globaux restent limités à 5 000 dossiers ; une colonne finale indique désormais le début de période, sans déplacer les colonnes préexistantes.
- Avant validation, l'administrateur voit le compte actuel et une estimation de la période créditée. Les horaires sont affichés à l'heure de Tunisie. Une note de vérification et une case de confirmation de réception des fonds sont obligatoires ; le serveur impose également ces conditions.
- Une approbation ne lève plus implicitement une suspension ou une résiliation. Le dossier reste en attente et renvoie 409 ; un refus reste possible. Pour approuver, l'administrateur doit d'abord réexaminer séparément le statut du compte.
- Les jours restants d'un compte ACTIVE ou TRIAL sont conservés. Sinon, la nouvelle période part de l'heure de validation. L'offre demandée s'applique immédiatement à toutes les boutiques du propriétaire, sans prorata ; cette politique existante est désormais explicite dans l'aperçu.
- Le calcul définitif, la décision, la mise à jour d'abonnement et l'audit restent dans une transaction verrouillée sur le compte. L'audit conserve l'offre, le statut et l'échéance précédents, la confirmation de vérification et les dates créditées. Un second envoi de la même décision ne crée pas de seconde prolongation.
- Les historiques administrateur et marchand présentent le début et la fin de période. Le dossier marchand ouvre directement la recherche de ses règlements.

### Compatibilité API

Pour approuver via `POST /api/admin/subscription-payments`, envoyer `receivedConfirmed: true` et une `adminNote` de 5 à 500 caractères. Une confirmation absente, fausse ou non booléenne est refusée (400). Il s'agit de l'attestation de vérification humaine, pas d'une intégration bancaire automatique.

`GET /api/admin/subscription-payments` accepte `status`, `method`, `recherche`, `page`. Il renvoie `payments`, `total`, `page`, `pages`, `pageSize` ; le défaut est désormais PENDING, par pages de 50. L'export conserve ALL comme défaut et devient paginé lorsque `page` est présent.

Les tests réels couvrent les validations concurrentes, la référence D17 déjà utilisée, l'isolation entre marchands, les déclarations sans activation immédiate, les refus, l'interdiction d'approbation des comptes suspendus/résiliés et la pagination/export sur 206 dossiers supplémentaires fictifs. Les tests arrêtent leur serveur de test sous Windows comme sous Linux.

## Suite proposée pour l'administration SaaS

1. Évolution des offres : compléter la politique commerciale de changements de formule (prorata éventuel et effet sur les quotas existants).
2. Pilotage : distinguer les paiements encaissés, les déclarations en attente et les montants attendus ; proposer une vue par mois et par offre.
3. Support marchand : récupération de mot de passe et notifications transactionnelles après choix et configuration du prestataire e-mail.
4. Validation : recette avec plusieurs marchands et plusieurs boutiques, droits d'accès, paiement déclaré puis approuvé, expiration et réactivation.

La facturation et les règlements restent manuels. Aucun prélèvement, envoi de message, changement de base, fusion sur `main` ou déploiement n'est inclus dans ce lot.

## Dépendances à traiter ensuite

L'audit npm signale encore cinq entrées de sévérité élevée : Zod et la chaîne d'outils Prisma (`prisma`, `@prisma/config`, `effect`, `deepmerge-ts`). Les correctifs proposés impliquent des changements de version majeure ; prévoir une migration dédiée avec validation des schémas et des migrations PostgreSQL. Le dépôt n'est donc pas présenté comme exempt de vulnérabilités ni prêt au lancement commercial.
