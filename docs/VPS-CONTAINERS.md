# Installation VPS avec conteneurs

Ce pack prépare le futur VPS Linux. Il ne crée aucun serveur, domaine, certificat réel ni abonnement payant. Render reste l’environnement de test existant et n’utilise pas ce Compose. Le déploiement réel et la reprise des données doivent être planifiés avec une sauvegarde restaurée et vérifiée.

## Services

`compose.yaml` contient PostgreSQL 18 sur réseau privé, une migration ponctuelle, l’application, le worker et un proxy Caddy activable par le profil `edge`. Seul Caddy publie 80/443 ; les ports Node et PostgreSQL ne sont pas publiés. L’application et le worker disposent d’un réseau de sortie pour les canaux explicitement configurés.

L’image Node 24 de production fonctionne sans root, avec système de fichiers en lecture seule et répertoires temporaires bornés. Le compilateur TypeScript et le CLI Prisma sont exclus de cette image ; l’image `migrator` distincte conserve le CLI et reçoit seule l’identifiant PostgreSQL administrateur. La configuration Next compilée correspond à `next.config.ts`. Les variables privées, même sous `deploy/vps/`, sont exclues du contexte de construction.

PostgreSQL utilise deux rôles : `tunicom_admin` pour l’initialisation et les migrations, `tunicom_app` pour les tables applicatives. Le rôle applicatif ne peut créer de base, de rôle ou de table, ni lire `_prisma_migrations`. L’initialisation crée les droits sur une base vide ; changer un mot de passe dans le fichier d’environnement ne modifie pas le rôle déjà présent dans un volume existant. Une rotation exige une modification SQL contrôlée puis la recréation des services concernés.

## Préparer la configuration

1. Installer Docker Engine et le plugin Compose actuels depuis leur source officielle sur le VPS Linux.
2. Conserver le code dans un répertoire dédié et la configuration dans un fichier privé hors du code, par exemple `/etc/tunicom/platform.env`, propriétaire de l’exploitant et mode `0600`. Utiliser `deploy/vps/environment.example` comme modèle.
3. Remplacer les domaines d’exemple. Générer trois secrets **distincts**, chacun de 32 octets aléatoires représentés par 64 caractères hexadécimaux minuscules : mots de passe PostgreSQL administrateur/application et clé de chiffrement Tunicom. Les conserver dans un coffre ; ne pas les envoyer dans la conversation.
4. Pour une installation vide, prévoir temporairement `SETUP_TOKEN` au même format. Après la création de l’administrateur par le parcours existant, retirer ce jeton de la configuration et recréer le service web. La restauration d’une installation existante ne nécessite pas de recréer ses comptes.
5. Laisser SMTP, webhooks et routage de domaines désactivés tant que leurs comptes et leur recette ne sont pas prêts. Le worker peut assurer sa présence et sa maintenance sans envoyer de messages.

Vérifier les valeurs avant démarrage, sans les afficher :

```sh
node scripts/vps-config.mjs --file=/etc/tunicom/platform.env
docker compose --project-name tunicom --env-file /etc/tunicom/platform.env config --quiet
docker compose --project-name tunicom --env-file /etc/tunicom/platform.env build web migrate
docker compose --project-name tunicom --env-file /etc/tunicom/platform.env --profile edge up -d --no-build
```

Le validateur refuse les domaines d’exemple et les secrets incomplets. `docker compose config` sans `--quiet` affiche les variables résolues : ne pas publier sa sortie. L’accès au daemon Docker permet de lire les environnements des conteneurs ; réserver cet accès aux exploitants autorisés.

Le validateur peut aussi être lancé sans installer Node sur le VPS, avec l’image officielle et sans réseau :

```sh
docker run --rm --network none --read-only --mount type=bind,src="$PWD",dst=/workspace,readonly --mount type=bind,src=/etc/tunicom/platform.env,dst=/run/tunicom.env,readonly --workdir /workspace node:24-bookworm-slim node scripts/vps-config.mjs --file=/run/tunicom.env
```

Les volumes nommés conservent PostgreSQL, les médias et les données/certificats Caddy après remplacement des conteneurs. Ne jamais utiliser `down --volumes` sur l’installation réelle. Les limites mémoire fournies sont un point de départ ; prévoir assez de mémoire pour la construction et superviser l’utilisation réelle avant ouverture au trafic.

## DNS, TLS et hôtes

Faire pointer le domaine plateforme vers le VPS puis vérifier son HTTPS réel. Pour les domaines de boutique, suivre `VPS-STOREFRONT-DOMAINS.md`. Le routage démarre désactivé. Lorsqu’il est activé, Caddy demande l’autorisation au serveur par un listener limité à son propre loopback ; cet appel utilise le Host canonique de la plateforme. Ni ce listener ni l’API d’administration Caddy ne sont publiés.

Le site plateforme reste explicite. Le site dynamique refuse le trafic lorsque le routage est désactivé, même si un ancien certificat existe encore. Lorsqu’il est activé, les contrôles de publication, d’abonnement et de liaison de domaine du serveur restent requis. L’autorisation d’émission ne prouve pas l’existence d’un certificat valide : tester DNS, TLS, catalogue, panier et refus des routes privées sur un vrai domaine contrôlé.

Les journaux d’accès Caddy sont désactivés. Ses journaux d’erreur filtrent la requête et les champs URI/URL/en-têtes pour éviter d’enregistrer les jetons de suivi. L’exercice conteneur vérifie ce cas avec un jeton fictif et un serveur web arrêté. Toute journalisation supplémentaire sur un proxy amont doit conserver cette protection.

## Médias et sauvegardes

Le volume des médias est réservé au service web et initialisé avec l’utilisateur applicatif et des permissions privées. `MEDIA_STORAGE_MODE=database` reste la valeur par défaut. Le miroir facultatif et ses commandes de copie/vérification sont documentés dans `MEDIA-STORAGE-TRANSITION.md`. Les originaux restent en PostgreSQL pendant cette transition ; la sauvegarde de la base conserve donc leur contenu.

Un volume ne constitue pas une sauvegarde indépendante. Le pack teste un dump et une restauration **de données fictives**, sans mettre en service de copie hors site réelle. Pour les vraies sauvegardes chiffrées, choisir une destination privée indépendante, adapter la connexion source VPS du mécanisme existant décrit dans `priority1-offsite-backup.md`, puis vérifier sa première sauvegarde et sa restauration isolée avant activation planifiée. La phrase de récupération doit être conservée aussi hors de l’hébergeur.

Un exercice réel devra valider tous les comptes, commandes, stocks et médias attendus, mesurer la durée de reprise et vérifier les protections du nouveau serveur. Ne pas restaurer une copie de test par-dessus la base active. Les migrations ne sont pas annulées par un retour à une ancienne image ; vérifier sa compatibilité avant tout retour de version.

## Mise à jour et contrôle

Les tags restent dans les versions majeures Node 24, PostgreSQL 18 et Caddy 2. Tester les mises à jour puis promouvoir l’image ou le digest validé. Ne pas changer la version majeure PostgreSQL en réutilisant simplement son ancien volume. Après une mise à jour, vérifier la santé web, `npm run worker:health` dans le worker, le diagnostic privé et un parcours réel de commande.

Une migration ponctuelle doit être rejouée pour chaque nouvelle image : recréer le service `migrate`, attendre sa réussite puis recréer web/worker avec l’image validée. Conserver les variables et la clé de chiffrement cohérentes entre services. Prévoir une fenêtre de maintenance pour une migration qui ne permet pas de coexistence ; les migrations actuelles sont additives mais cela ne garantit pas celles à venir.

## Exercice automatisé jetable

Le workflow **Tunicom VPS container lifecycle and restore** utilise un projet Docker aléatoire `tunicom-ci-*`, des secrets fictifs générés et des ports HTTP limités au loopback du runner. Il construit les images réelles, valide la configuration HTTPS avec le réseau du conteneur désactivé, puis teste démarrage, rôles SQL, frontières privées via proxy, médias persistants, SIGTERM du worker, remplacement des conteneurs, dump/restauration et confidentialité des erreurs proxy.

Il ne reçoit pas les secrets de production, n’envoie aucun e-mail/SMS, ne demande aucun certificat réel et ne pousse aucune image vers un registre. Son nettoyage ne peut cibler qu’un projet généré par le script et ses volumes jetables. `compose.ci.yaml` et `scripts/vps-container-test.mjs` sont réservés à cette recette et ne doivent pas servir à lancer la plateforme publique.

Références : [image PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/README.md), [image Node](https://github.com/nodejs/docker-node), [options Caddy](https://caddyserver.com/docs/caddyfile/options), [validation Caddy](https://caddyserver.com/docs/command-line#caddy-validate).
