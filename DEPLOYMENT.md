# Déploiement de test sur Render et Neon

## Ressources existantes

- GitHub : https://github.com/dalimouxx/tunicommerce (dépôt public, branche `main`). Aucun secret ne doit être ajouté au dépôt.
- Application : https://tunicommerce-test.onrender.com
- Render : service `tunicommerce-test`, Frankfurt, formule Free, espace « Dali Moussa's Workspace ».
- PostgreSQL : projet Neon `tunicommerce-test`, base `tunicommerce`, PostgreSQL 18, Frankfurt, offre Free. La base est externe ; aucune base Render n’est requise.

`DATABASE_URL` et `SETUP_TOKEN` sont configurés dans les variables privées du service Render. Le Blueprint utilise `sync: false` pour la connexion externe. La construction exécute `npm ci --include=dev && npm run build`. Le démarrage exécute `npm run db:migrate && npm start` et écoute sur `0.0.0.0:$PORT`.

Les déploiements automatiques suivent les commits de `main`. Avant d’y publier des modifications de schéma ou de comportement, exécuter les vérifications sur une branche de travail. Le workflow inclut `platform-spaces` et les pull requests. Le contrôle GitHub de la version 0.5 a réussi : TypeScript, 40 tests métier/sécurité, migrations, build et 9 scénarios HTTP avec PostgreSQL 18.

## Accès

- `/login` : connexion des marchands et du superadministrateur.
- `/admin` : gestion des marchands, publication et abonnements. Le compte initial a le rôle ADMIN ; les comptes créés ensuite ont le rôle MERCHANT.
- `/` : espace marchand privé.
- `/boutiques` et `/boutiques/{slug}` : annuaire et boutique publique.

Sur une installation neuve uniquement, `/setup` permet de créer le premier compte à l’aide de SETUP_TOKEN. L’installation existante est déjà initialisée. Ne pas partager ce jeton ni les mots de passe dans le chat ou GitHub.

Une boutique publique doit avoir un slug, être publiée et posséder un abonnement TRIAL ou ACTIVE dont l’échéance est future. L’administration configure ces champs. Les abonnements sont manuels, sans paiement récurrent ni quotas par offre. Les nouveaux marchands commencent avec un catalogue vide.

## Migrations et vérifications

La migration 0.5 ajoute les rôles, paramètres de publication/abonnement, reçus d’idempotence et journal administratif sans supprimer de données. Elle a été essayée sur la branche Neon `platform-migration-check` avant déploiement. Cette branche est une copie de vérification, jamais la base utilisée par Render.

Ne pas utiliser `db push --accept-data-loss` ou `migrate reset` sur la base de l’application. Les tests d’intégration destructifs sont réservés à une base isolée explicitement suffixée `_test`, créée dans le conteneur PostgreSQL éphémère de GitHub Actions.

Après déploiement, vérifier `/api/health` (database=ok), l’accès anonyme refusé à `/api/commerce`, la redirection de `/admin` sans session et l’affichage de la boutique publique. Les tests de commandes réelles dans cette instance peuvent modifier les stocks ; utiliser des données de démonstration.

`RENDER_EXTERNAL_URL` définit l’origine autorisée. Pour un domaine personnalisé, définir `APP_URL` sur son origine HTTPS exacte puis redéployer. Les ressources gratuites peuvent se mettre en veille ; cette instance reste un environnement de test.

Le lanceur `scripts/migrate.mjs` utilise une connexion Neon directe pour les migrations (suppression du suffixe `-pooler` du nom d’hôte), tout en conservant la connexion partagée pour l’application. `DIRECT_DATABASE_URL` permet de fournir explicitement une connexion de migration différente. Les verrous Prisma restent activés.
