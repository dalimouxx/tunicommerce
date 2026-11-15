# Déploiement Tunicom sur VPS

## Production

- GitHub : https://github.com/dalimouxx/tunicommerce (dépôt public, branche `main`). Aucun secret ne doit être ajouté au dépôt.
- Application : https://tunicom.shop
- Boutiques : `https://nom-boutique.tunicom.shop`, ou domaine personnel vérifié et choisi par le marchand.
- Hébergement : VPS Ubuntu, Docker Compose, PostgreSQL privé et proxy HTTPS commun aux plateformes.

La configuration privée Tunicom est conservée sur le VPS dans `/etc/tunicom/platform.env`. `APP_URL=https://tunicom.shop` définit l'origine de l'application ; `STOREFRONT_DOMAIN_ROUTING=enabled` et `STOREFRONT_ROOT_DOMAIN=tunicom.shop` activent les adresses de boutique. Les secrets ne doivent apparaître ni dans Git ni dans les journaux publics.

Le workflow `vps-deploy.yml` déploie la révision exacte de `main` après les contrôles d'application, de cycle Docker/restauration et d'opérations VPS. Le contrôleur valide les images, sauvegarde, migre puis vérifie le site et le worker. Telegram reçoit le résultat. Les changements du proxy commun restent des opérations explicites ; un déploiement applicatif ne recrée pas Fixi.

## Accès

- `/connexion/boutique` : connexion des marchands.
- `/connexion/admin` : connexion du superadministrateur.
- `/admin` : gestion des marchands, publication et abonnements. Le compte initial a le rôle ADMIN ; les comptes créés ensuite ont le rôle MERCHANT.
- `/` : présentation publique de Tunicom.
- `/mes-boutiques` : espace marchand privé.
- `/boutiques` et `/boutiques/{slug}` : annuaire et boutique publique.

Sur une installation neuve uniquement, `/setup` permet de créer le premier compte à l’aide de SETUP_TOKEN. L’installation existante est déjà initialisée. Ne pas partager ce jeton ni les mots de passe dans le chat ou GitHub.

Une boutique publique doit respecter les conditions de publication et d'abonnement. Les nouveaux marchands commencent avec un catalogue vide. Les domaines personnels nécessitent une preuve de propriété TXT récente ; ils ne donnent aucun accès aux routes privées de la plateforme. Voir [le guide des adresses](ops/vps/STOREFRONTS.md).

## Migrations et vérifications

Les migrations versionnées de Prisma sont exécutées par le migrateur VPS avec un rôle distinct du rôle applicatif. Les tests HTTP et les exercices de restauration doivent utiliser une base jetable.

Ne pas utiliser `db push --accept-data-loss` ou `migrate reset` sur la base de l’application. Les tests d’intégration destructifs sont réservés à une base isolée explicitement suffixée `_test`, créée dans le conteneur PostgreSQL éphémère de GitHub Actions.

Après déploiement, vérifier `/api/health` (database=ok), l’accès anonyme refusé à `/api/commerce`, la redirection de `/admin` sans session et l’affichage de la boutique publique. Les tests de commandes réelles dans cette instance peuvent modifier les stocks ; utiliser des données de démonstration.

Les sauvegardes quotidiennes sont planifiées entre 03h20 et 03h35, heure GMT+1. La surveillance VPS contrôle les services chaque minute ; `vps-public-health.yml` ajoute un contrôle HTTPS externe avec alertes Telegram. Les sauvegardes actuelles sont locales au VPS.

Les fichiers d'un ancien environnement d'essai ne constituent pas la configuration de production. Ne pas appliquer une autre définition Compose au proxy ou aux bases existants sans vérifier les réseaux et les volumes.
