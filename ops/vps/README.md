# GitHub → VPS Tunicom et alertes Telegram

Cette configuration prépare le déploiement de **Tunicom seulement**, et la
surveillance commune du VPS. Elle n'active rien sur le serveur par sa présence
dans GitHub. Fixi reste sur `fixiphone.io`. Studyinworld pourra rejoindre la
surveillance lorsque son domaine et son installation seront prêts.

## Conditions avant activation

Terminer d'abord l'installation manuelle de Tunicom : base neuve, configuration
privée `/etc/tunicom/platform.env` (0600), projet `tunicom-production`, routage
par le proxy commun, HTTPS et `/api/health` fonctionnels. Ne pas activer le profil
Compose `edge` de Tunicom : les ports 80/443 appartiennent au proxy partagé.

Le réseau externe `platforms-tunicom-edge` relie uniquement le web Tunicom au
proxy. Copier `compose.shared-edge.yaml` vers
`/srv/platforms/tunicom/compose.shared-edge.yaml` (root, 0644), et l'utiliser
également pour l'installation initiale. Les secrets restent hors des sources.
Ne pas appliquer ces étapes avant que les configurations du proxy aient été
validées et sauvegardées : ce document ne réalise pas la bascule de Caddy.

## 1. Accès GitHub limité

Créer une **nouvelle** paire Ed25519 dédiée à GitHub Actions. Placer la clé
privée uniquement dans le secret GitHub `VPS_SSH_PRIVATE_KEY`, et la clé publique
dans `/root/tunicom-deploy.pub` sur le VPS. Ne partager aucune clé privée ni
jeton dans le chat. Depuis une version du dépôt relue, dans la console root :

```sh
sh ops/vps/install.sh /root/tunicom-deploy.pub
```

L'utilisateur `tunicom-deploy` n'appartient pas au groupe Docker et n'a pas de
shell interactif utilisable par cette clé. Sa clé publique est enfermée dans
une commande SSH imposée ; sudo autorise seulement le contrôleur sans argument.
Les fichiers d'opérations et son répertoire SSH sont administrés par root.
Si `sshd_config` contient `AllowUsers`, ajouter cet utilisateur explicitement.
Les commandes et le contenu arbitraires reçus via SSH ne sont pas exécutés.

Copier `deploy.example.json` dans `/etc/tunicom/deploy.json` (root, 0600).
Le Compose de base reste celui de la version **initialement vérifiée** : les
déploiements ne remplacent que les images web, worker et migration. Toute
évolution d'infrastructure ou mise à jour des scripts root demande une revue et
une installation manuelles. Ne pas supprimer cette version initiale, dont le
Compose monte aussi le script d'initialisation PostgreSQL.

Enrôler seulement une installation déjà saine, en donnant son commit et son tag
d'image exacts. Pour les images initiales actuellement construites :

```sh
python3 /opt/tunicom-ops/bootstrap.py 13889d3189648e45ff390291433b6f879252fccf 13889d318964
```

Le contrôleur refuse de créer une base initiale. Il ne recrée jamais le proxy,
les services Fixi/Studyinworld ou la base de données lors d'un déploiement.

## 2. Secrets et paramètres GitHub

Dans le dépôt → Settings → Secrets and variables → Actions :

| Type | Nom | Valeur |
|---|---|---|
| Variable | `VPS_HOST` | `187.126.31.110` |
| Variable | `VPS_PORT` | `22` |
| Secret | `VPS_SSH_PRIVATE_KEY` | Clé privée dédiée |
| Secret | `VPS_SSH_KNOWN_HOSTS` | Ligne de clé publique du serveur, vérifiée dans la console Hostinger |
| Secret | `TELEGRAM_BOT_TOKEN` | Jeton du bot existant |
| Secret | `TELEGRAM_CHAT_ID` | Identifiant numérique de la conversation autorisée |
| Variable | `VPS_AUTODEPLOY_ENABLED` | `true`, **en dernier**, une fois les contrôles suivants réussis |
| Variable | `VPS_MONITOR_ENABLED` | `true` pour le contrôle extérieur depuis GitHub |
| Variable | `VPS_MONITOR_TUNICOM` | `true` seulement après la mise en ligne HTTPS de Tunicom |
| Variable | `VPS_MONITOR_FIXI` | `true` pour surveiller le Fixi existant depuis GitHub |

Obtenir la clé publique SSH du **serveur** depuis la console Hostinger déjà
authentifiée (pas une collecte réseau non vérifiée) :

```sh
printf '187.126.31.110 '
cat /etc/ssh/ssh_host_ed25519_key.pub
```

Pour un port différent de 22, utiliser `[187.126.31.110]:PORT` comme premier
champ. Cette ligne publique, sans retour au milieu, constitue le secret
`VPS_SSH_KNOWN_HOSTS`. Ne jamais désactiver la vérification de l'hôte SSH.

Dans Telegram, ouvrir le bot et appuyer sur **Démarrer**. Pour un groupe, y
ajouter le bot et lui permettre d'écrire. Récupérer le `chat_id` via l'API du bot
depuis un outil privé ; ne pas coller d'URL contenant son jeton dans le chat.

## 3. Surveillance et sauvegarde quotidienne

Copier `monitor.example.json` vers `/etc/platforms/monitor.json` (root, 0600).
Dans ce fichier, activer Tunicom et ses deux indicateurs uniquement après sa
mise en ligne. Adapter la liste des conteneurs à la bascule réelle du proxy :
`fixi-caddy-1` cessera d'être le bon nom après le passage au proxy commun.
Les contrôles Fixi existants peuvent être activés indépendamment ; il n'y a pas
encore d'alerte de sauvegarde Fixi ou Studyinworld dans ce lot.

Créer **dans l'éditeur privé du VPS** `/etc/platforms/telegram.json` :

```json
{"token":"REMPLACER_LOCALEMENT", "chat_id":"REMPLACER_LOCALEMENT"}
```

```sh
chown root:root /etc/platforms/telegram.json
chmod 600 /etc/platforms/telegram.json
python3 /opt/tunicom-ops/telegram_test.py
python3 /opt/tunicom-ops/backup.py
systemctl start platforms-monitor.service
systemctl enable --now platforms-monitor.timer tunicom-backup.timer
```

Les incidents nécessitent deux observations consécutives. Un rétablissement
nécessite également deux succès. Au maximum un rappel par incident et par heure.
Si Telegram ne répond pas, la notification est retentée au cycle suivant ; une
panne disparue avant livraison n'engendre pas une fausse alerte de rétablissement.
Les messages de déploiement émis par GitHub ne sont pas mis en file : en cas
d'échec Telegram, le journal GitHub affiche un avertissement.

Le moniteur contrôle HTTPS, les conteneurs sélectionnés, le disque (moins de
10 % libres ou de 8 Gio), le dernier déploiement et les sauvegardes Tunicom
(échec ou plus de 30 h). Il tourne sur ce VPS : **si tout le VPS ou son réseau
s'arrête, il ne peut plus envoyer d'alerte**. Le workflow `vps-public-health.yml`
ajoute un contrôle extérieur depuis GitHub, à activer avec les variables du
tableau ci-dessus. Une mauvaise configuration du moniteur reste visible avec
`systemctl status platforms-monitor.service` et `journalctl -u platforms-monitor.service`.

Le contrôle extérieur est demandé toutes les cinq minutes, après deux
observations en échec, sans accès SSH au VPS. GitHub peut retarder ou omettre
une exécution planifiée : ce n'est pas une garantie de délai d'alerte. Le cache
GitHub conserve uniquement les compteurs et dates, sans secret. Son éviction
peut réinitialiser la temporisation et la déduplication. Les alertes extérieures
portent la mention `CONTROLE EXTERNE`. Les alertes locales, plus rapides,
continuent à fonctionner indépendamment. Studyinworld n'est pas surveillé tant
que son domaine n'est pas défini.

La sauvegarde quotidienne (03:20, fuseau du serveur, décalage aléatoire jusqu'à
15 minutes) est **locale**, sans rétention automatique ni copie hors site. Les
archives privées sont dans `/var/backups/tunicom`. Elle inclut les médias
uniquement si ceux-ci restent en base. Le mode fichiers est refusé pour éviter
une sauvegarde incomplète. Configurer ensuite une destination indépendante et
une rétention ; les alertes et seuils de disque ne remplacent pas ces étapes.
Le contrôle `pg_restore --list` valide le format de l'archive, **pas une
restauration complète**. Tester périodiquement une restauration isolée.

## Déroulement automatique

Après un push sur `main`, GitHub attend les tests applicatifs, le cycle Docker
avec restauration, et les tests des opérations, pour **le même commit**.
Une PR ou un fork ne reçoit pas les secrets. Les déploiements sont sérialisés,
sans annuler une migration en cours. Les commits devenus obsolètes sont ignorés.

Le VPS construit les deux images successivement, vérifie l'état initial,
suspend seulement le web/worker Tunicom, sauvegarde PostgreSQL, migre, redémarre,
attend la santé des conteneurs et vérifie HTTPS + accès base avant le message de
succès. Cette première version comporte une courte maintenance pendant la
sauvegarde et la migration ; elle ne promet pas un déploiement sans interruption.

Si l'échec survient avant toute migration, les anciennes images sont relancées.
Après le début des migrations, aucune restauration destructive ni retour à un
schéma antérieur n'est automatique. Consulter les marqueurs privés
`/var/lib/tunicom-deploy/progress.json`, `current.json`, `backup.json` et les logs
Tunicom dans la console root. GitHub et Telegram ne reçoivent ni logs bruts,
ni secrets, ni commandes/clients. Un échec de connexion SSH peut être annoncé
par GitHub même si le contrôleur déjà lancé continue sur le VPS : vérifier le
marqueur avant toute intervention et ne pas supprimer le verrou manuellement.

Ne pas exécuter de `docker compose down -v` ni de nettoyage Docker global sur
ce serveur partagé. Les anciennes images, versions et archives ne sont pas
supprimées par ces scripts. Pour désactiver les futurs déploiements, passer
`VPS_AUTODEPLOY_ENABLED` à `false` ; ne pas interrompre une migration en cours.

Sources : [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run),
[restrictions authorized_keys](https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT),
[API Telegram](https://core.telegram.org/bots/api#sendmessage).
