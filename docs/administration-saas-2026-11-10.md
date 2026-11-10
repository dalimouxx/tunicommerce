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

`npm test` découvre les tests unitaires automatiquement : 97 fichiers, 327 tests réussis. Les tests unitaires ne reçoivent pas les variables de connexion PostgreSQL.

`npm run typecheck` et `npm run build` passent sur la version finale (Node.js 24, Next.js 16.4.6, Prisma 7.10.1, Zod 4.6.7).

`npm run test:integration` conserve le parcours PostgreSQL historique. `npm run test:integration:all` exécute les 17 suites PostgreSQL/HTTP en série afin d'éviter leurs effacements concurrents de tables. Cette commande exige `DATABASE_URL` et `TEST_DATABASE_URL` identiques, sur une base jetable dont le nom se termine par `_test`. L'exercice de restauration, qui exige une sauvegarde préparée et une phase explicite, reste dans son workflow dédié.

Les 17 suites PostgreSQL/HTTP ont été exécutées localement en série : 120 tests réussis sur PostgreSQL 18, dans une base jetable séparée de toute base existante. La recette visuelle interactive de l'administration reste à effectuer.

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

## Troisième lot — bilan financier mensuel

- `/admin/finances-saas` propose un mois calendaire, une offre et un moyen de règlement. Les montants et nombres de dossiers sont ventilés séparément entre validations, déclarations encore en attente et refus, puis répartis par offre et par moyen.
- Les validations et les refus sont rattachés au mois de leur décision ; les dossiers encore en attente, à leur mois de dépôt. Une déclaration déposée en septembre et approuvée en novembre est donc comptée dans les validations de novembre. Une décision sans date n'est pas inventée et reste hors du bilan mensuel.
- Les limites mensuelles suivent `Africa/Tunis`, indépendamment du fuseau de l'hôte. Le début est inclus et le début du mois suivant exclu. Le mois par défaut suit également le calendrier tunisien ; les années bissextiles et le changement d'année sont testés.
- La comparaison avec le mois précédent applique les mêmes filtres. Si le montant précédent est nul, aucun pourcentage trompeur ou infini n'est affiché. Le mois courant peut être incomplet : cette comparaison n'est pas une projection de revenu.
- La situation des dossiers en attente est leur situation actuelle. Elle peut évoluer après une décision ; le bilan ne prétend pas reconstituer un arrêté comptable historique. Les indicateurs globaux, indépendants des filtres mensuels, sont présentés dans une section distincte.
- L'export `/api/admin/finances-saas/export?mois=2026-11&offre=PRO&method=D17` utilise les mêmes filtres et montants entiers en millimes. Chaque combinaison offre/moyen/statut figure une seule fois ; aucun total ou sous-total dupliqué n'est ajouté aux lignes. L'export agrégé n'inclut ni coordonnées marchands ni données d'acheteurs.
- Les filtres invalides sont signalés explicitement (400 pour l'export), sans exporter une autre période à la place. Le rapport et l'export sont réservés à l'administration ; l'export est privé et non mis en cache.
- Les totaux sont agrégés dans PostgreSQL sur tous les dossiers correspondants, sans charger les paiements individuels dans le navigateur. Aucun changement de schéma, d'abonnement ou de paiement n'est effectué par le bilan.

Les cinq tests unitaires supplémentaires et le scénario PostgreSQL/HTTP vérifient les dates de rattachement, les frontières mensuelles en Tunisie, la conservation des filtres, les sommes par groupe, les millimes exacts, la protection CSV et les refus d'accès. La compilation de production et les tests passent sur la version finale.

## Quatrième lot — migration de sécurité des dépendances

- Prisma, son client et l'adaptateur PostgreSQL passent à 7.10.1 ; Zod passe à 4.6.7. Les cinq alertes élevées précédentes disparaissent : l'audit npm du 10 novembre 2026 ne signale aucune vulnérabilité connue dans l'arbre de dépendances installé.
- Prisma utilise l'adaptateur `@prisma/adapter-pg`. Le générateur `prisma-client-js` reste conservé pour préserver les imports `@prisma/client` existants ; son moteur client et son chemin de sortie sont explicites. Les fichiers générés restent dans `node_modules` et ne sont pas versionnés.
- `prisma.config.ts` contient la configuration CLI. Les variables `.env` sont chargées explicitement par `dotenv`, y compris avant le choix de l'URL de migration dans `scripts/migrate.mjs`. La sélection existante de l'URL directe pour les migrations est conservée.
- Le pool runtime utilise cinq connexions par défaut, un délai d'acquisition/connexion de cinq secondes et trente secondes d'inactivité. Les paramètres historiques `connection_limit` (1 à 50) et `pool_timeout` (1 à 120 secondes) sont traduits pour pg. `schema` est transmis à l'adaptateur ; les paramètres TLS de l'URL restent conservés. Une configuration invalide ne révèle pas les identifiants dans son message d'erreur.
- Sans `DATABASE_URL`, les builds et imports restent possibles ; une requête ne peut pas utiliser implicitement une base définie par les variables PGHOST/PGDATABASE de la machine. La cible de remplacement est un port local fermé, non une base de données existante.
- Les validations des coordonnées de paiement, les vues de suivi et les palettes de thèmes sont séparées des accès PostgreSQL. Le pilote de base de données n'est plus importé indirectement par ces composants navigateur.
- La personnalisation du message de gouvernorat est adaptée à Zod 4. Les validations métier existantes passent les tests sans assouplissement des schémas pour contourner la migration.
- Les serveurs de test sont arrêtés avec leurs processus enfants sur Windows, et normalement sur Linux. L'ancien test PostgreSQL nettoie les organisations avant les propriétaires pour fonctionner correctement après les autres suites.
- La CI principale exécute désormais l'audit npm (bloquant dès la sévérité élevée) et les 17 suites d'intégration en série, en plus des tests unitaires, du contrôle TypeScript et du build.

### Vérifications de migration

Les dix migrations SQL existantes sont reconnues sur une base déjà migrée, s'appliquent sur une base vide et ne sont pas rejouées au redémarrage suivant. La comparaison `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` indique **No difference detected**. Aucun fichier SQL de migration n'a été modifié et aucune nouvelle migration n'est nécessaire.

Les 327 tests unitaires et 120 tests PostgreSQL/HTTP passent après migration. Ils couvrent notamment les sessions, l'administration, les équipes, la séparation des boutiques, les médias, les quotas, le stock concurrent, les commandes COD, les règlements et le bilan mensuel. La base locale jetable a été arrêtée à la fin des vérifications.

La connexion TLS à la base hébergée et la recette visuelle interactive ne sont pas vérifiées par ces essais locaux. Le pilote pg 8.23.1 émet un avertissement de dépréciation dans certains scénarios transactionnels concurrents ; ces scénarios passent, mais ce point devra être traité avant une migration vers pg 9. L'audit npm n'est pas un audit de sécurité exhaustif de l'application.

Références de migration : [guide Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [guide Zod 4](https://zod.dev/v4/changelog).

## Suite proposée pour l'administration SaaS

1. Évolution des offres : compléter la politique commerciale de changements de formule (prorata éventuel et effet sur les quotas existants).
2. Pilotage : définir les besoins de suivi sur plusieurs mois et les contrôles de rapprochement avec les justificatifs externes.
3. Support marchand : récupération de mot de passe et notifications transactionnelles après choix et configuration du prestataire e-mail.
4. Validation : recette avec plusieurs marchands et plusieurs boutiques, droits d'accès, paiement déclaré puis approuvé, expiration et réactivation.

La facturation et les règlements restent manuels. Aucun prélèvement, envoi de message, changement des bases hébergées, fusion sur `main` ou déploiement n'est inclus dans ce lot.

