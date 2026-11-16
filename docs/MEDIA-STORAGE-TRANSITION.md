# Transition des médias vers un stockage privé sur VPS

## Périmètre de cette étape

Les photos de produits, logos et bannières peuvent posséder une copie sur un système de fichiers privé et persistant. Les accueils, pages publiées et domaines de boutique réutilisent les mêmes contrôles d’accès et les mêmes URL. **PostgreSQL conserve tous les originaux** tant que l’exploitant ne lance pas la libération décrite plus bas (mode `filesystem-primary`, sur demande uniquement). Les lectures d’images peuvent ainsi passer par le disque et la migration être testée avant de réduire le stockage en base.

Les écritures du catalogue, des commandes et des clients ne sont pas migrées par ce lot. Aucun prestataire de stockage objet n’est choisi. Cette option est destinée à une instance VPS avec un disque local fiable, pas à plusieurs instances dotées chacune de leur propre disque.

## Configuration et retour arrière

Par défaut, `MEDIA_STORAGE_MODE=database` conserve le parcours PostgreSQL existant. Sur le VPS, préparer un répertoire privé **hors du code et de `public/`**, par exemple `/srv/tunicom-media`, appartenant à l’utilisateur du serveur, avec permissions `0700`. Ce chemin doit déjà exister et être le chemin canonique réel du montage ; le serveur ne crée pas automatiquement la racine si un montage manque.

Configurer `MEDIA_STORAGE_ROOT=/srv/tunicom-media` et `MEDIA_STORAGE_MODE=filesystem-mirror`, puis redémarrer le serveur. Les fichiers créés ont les permissions `0600` sur Linux ; sous Windows l’exploitant doit imposer une ACL privée, les modes Unix n’y apportent pas cette garantie. Ne pas activer ce mode sur le système de fichiers éphémère du Render de test. Un volume n’est pas une sauvegarde.

Revenir à `MEDIA_STORAGE_MODE=database` désactive les lectures et nouvelles copies sur disque. Aucun déplacement inverse n’est nécessaire puisque les originaux sont toujours en base. Ne pas supprimer les colonnes ou tables de médias pour effectuer ce retour arrière.

## Garanties de lecture et de copie

- Les permissions de boutique et la publication sont contrôlées avant tout accès à une copie ; aucun dossier n’est servi directement par le serveur HTTP.
- Chaque clé contient l’identifiant du compte marchand et le SHA-256 du contenu. Elle ne contient ni nom de fichier fourni par le navigateur ni URL distante.
- Les écritures passent par un fichier temporaire, synchronisé, puis un lien atomique sans remplacement. Le contenu est vérifié avant son référencement en base. Les répertoires et objets symboliques sont refusés ; le répertoire racine doit être réservé à l’application et protégé contre toute modification par d’autres comptes locaux.
- Un déclencheur PostgreSQL vérifie que chaque référence correspond aux octets et à la taille de sa ligne. Une modification des octets sans nouvelle copie valide efface automatiquement la référence périmée. Il n’exige pas d’extension PostgreSQL.
- Une copie absente, illisible ou altérée entraîne une lecture de l’original PostgreSQL. Un remplacement concurrent doit conserver des métadonnées compatibles ; à défaut, la requête échoue temporairement au lieu d’associer une ancienne taille à un nouveau contenu.
- Une panne de copie n’empêche pas l’enregistrement de l’original ; un avertissement serveur générique est émis. Le diagnostic et la vérification permettent de repérer les copies à compléter.

La copie est limitée à 2 Mio par objet, 512 fichiers et 64 Mio par compte sur le disque, avec une réserve de 256 Mio d’espace disponible. Ces seuils limitent les copies, pas les droits commerciaux : une limite atteinte conserve les nouvelles images uniquement en base. Les garde-fous ne remplacent pas la supervision de capacité et du montage. Les écritures de l’application et de l’outil de copie partagent le verrou PostgreSQL du compte.

## Migration par lots et vérification

Toutes les commandes sont destinées à l’exploitant ; elles n’affichent ni contenu d’image ni secret.

```sh
npm run media:storage -- --action=status
npm run media:storage -- --action=copy --kind=product --limit=25
npm run media:storage -- --action=copy --kind=brand --limit=25
npm run media:storage -- --action=verify --kind=product --limit=25
npm run media:storage -- --action=verify --kind=brand --limit=25
```

Passer le `nextCursor` retourné avec `--after=UUID` jusqu’à obtenir `null`. Une page exactement pleine peut être suivie d’une dernière page vide. `--workspace-id=UUID` limite le traitement à un compte. Chaque passage charge au plus 25 images et conserve les originaux. `copy` est idempotent pour un contenu identique et ne modifie ni publication ni données commerciales. Une copie corrompue existante n’est pas remplacée silencieusement : désactiver le miroir, isoler le fichier concerné dans une intervention contrôlée, puis relancer la copie depuis l’original.

Codes de sortie : 0 si le passage ne rencontre aucune anomalie, 1 pour copies manquantes, indisponibles ou modifiées simultanément, 2 pour configuration/arguments/service indisponibles. `status` donne un inventaire ; la présence d’un chemin configuré ou d’une référence en base ne prouve pas la bonne santé de chaque fichier. Utiliser `verify` pour cette preuve.

## Rétention et sauvegardes

Les anciens fichiers ne sont pas effacés au moment d’un remplacement ou d’une suppression de photo. Un nettoyage contrôlé peut retirer les copies sans référence après sept jours, en tenant compte de la date de modification et du dernier changement de métadonnées du fichier. Les fichiers encore référencés par une photo ou un logo sont conservés, de même que les fichiers récents, les liens symboliques et les noms inconnus. Un répertoire dépassant 512 entrées est laissé à l’inspection de l’exploitant. Aucun répertoire n’est supprimé.

Le nettoyage prend le même verrou de compte que les dépôts, remplacements et copies. Avant d’effacer un candidat, il vérifie à nouveau son identité, sa taille et ses dates ; un changement entraîne son report. Il vérifie aussi que les contraintes `ProductMedia_content_or_copy` et `ShopMedia_content_or_copy` sont en place : une ligne sans octets en base garde obligatoirement sa référence de fichier. Le fichier d’une photo libérée est donc toujours « référencé » et n’est jamais effacé. Si ces contraintes disparaissent, le nettoyage est bloqué.

L’aperçu ne supprime rien :

```sh
npm run media:cleanup -- --workspace-id=UUID
npm run media:cleanup -- --workspace-id=UUID --apply
npm run media:cleanup -- --limit=10
```

Une passe traite au plus dix comptes et sélectionne au plus 25 fichiers par compte. Pour parcourir les comptes, reprendre `nextCursor` avec `--after=UUID` jusqu’à `null`. Le surplus de copies anciennes d’un même compte attend une passe suivante. Les résultats agrégés distinguent candidats, suppressions, fichiers conservés, changements concurrents et indisponibilités, sans afficher les noms des médias.

La planification est désactivée par défaut. Sur le VPS, après aperçu et configuration du miroir, `MEDIA_GC_ENABLED=true` dans le service web autorise `npm run media:cleanup -- --scheduled`. Ce mode traite une page et conserve son curseur dans `MaintenanceProgress`, avec verrou concurrent non bloquant. Une erreur de stockage est conservée sur le cycle ; la date de cycle réussi n’avance pas en cas d’erreur. Les modèles systemd `tunicom-media-cleanup.service` et `.timer` exécutent une passe toutes les quinze minutes, uniquement après installation explicite par l’exploitant. Adapter leur répertoire au VPS. Ils ne sont pas installés ni activés sur Render par cette livraison.

Les suppressions concernent des copies sans référence, pas les lignes PostgreSQL ou les images conservées par les historiques. Les fichiers orphelins d’anciens médias remplacés peuvent disparaître après le délai : ce répertoire ne remplace pas une sauvegarde historique. Les originaux des médias courants restent en base et permettent leur récupération. Les opérations sur disque et PostgreSQL ne constituent pas une transaction atomique ; vérifier le résultat de chaque passage et superviser les erreurs.

Dès que le mode n’est plus `database`, la sauvegarde du VPS archive aussi le volume des médias (voir plus bas). Tant qu’aucune photo n’est libérée, la sauvegarde PostgreSQL contient encore tous les octets et permet à elle seule le retour au mode `database`. Tester une restauration sur une base isolée et vérifier les images.

## Libérer la base des photos (option, sur demande)

Objectif : alléger PostgreSQL en ne gardant la photo que sur le disque privé. **Rien ne se fait automatiquement** : il faut le mode `filesystem-primary` et lancer la commande soi-même.

Garde-fous :

- `release` refuse tout si `MEDIA_STORAGE_MODE` n’est pas `filesystem-primary`.
- `release` refuse tout si la dernière sauvegarde des photos n’est pas réussie ou date de plus de 30 heures. La sauvegarde du VPS écrit ce témoin dans `/srv/tunicom-media/.backup-status.json`. Elle le remet à « en cours » dès son démarrage, ce qui bloque toute libération pendant qu’elle tourne.
- Une ligne n’est libérée que si son fichier est relu et identique **octet pour octet** à l’original en base, sous le verrou du compte. Sinon elle est ignorée (`skipped`) et garde ses octets.
- PostgreSQL refuse d’effacer des octets dont la référence ne correspond pas à leur SHA-256. Il refuse aussi de changer la référence ou la taille d’une photo libérée, ou d’insérer une photo sans octets.
- Une photo libérée est lue **uniquement** sur le disque. Si le fichier manque ou est altéré, l’image est indisponible et une erreur serveur est journalisée. Aucune autre image n’est servie à la place.

```sh
npm run media:storage -- --action=copy --kind=product --limit=25
npm run media:storage -- --action=verify --kind=product --limit=25
npm run media:storage -- --action=release --kind=product --limit=25 [--workspace-id=UUID]
npm run media:storage -- --action=status
```

Commencer par un seul compte (`--workspace-id`), contrôler les images de la vitrine, puis continuer avec `--after=UUID`. Faire de même avec `--kind=brand`. `status` indique le nombre de photos libérées, `canonicalBytesRetained` (`false` dès qu’une photo est libérée) et `mediaBackupFresh`. Code de sortie 1 si des lignes ont été ignorées.

**Retour arrière** : `--action=restore` remet en base les octets relus et vérifiés sur le disque, par lots de 25. C’est obligatoire avant de revenir au mode `database` si des photos sont libérées. Une photo dont le fichier manque reste libérée et est comptée `unavailable` : la récupérer depuis l’archive des médias.

**Restaurer une sauvegarde** : avec des photos libérées, la base seule ne suffit plus. Il faut restaurer **ensemble** le `.dump` et le `.media.tar` portant le même horodatage. L’archive des fichiers est prise *avant* la base. Toute photo libérée avant la sauvegarde a donc son fichier dans l’archive :

```sh
docker compose run --rm --no-deps -T --entrypoint tar web -C /srv/tunicom-media -xf - < /var/backups/tunicom/<horodatage>-<run>.media.tar
```

Ensuite, lancer `verify` pour les deux types. Après le délai de nettoyage (7 jours), une ancienne archive de base ne retrouve ses fichiers que dans **sa propre** archive de médias.

Limites : les sauvegardes restent locales au VPS, sans copie hors site ni rétention automatique (voir `ops/vps/README.md`). Avant de libérer une quantité importante de photos, mettre en place une copie hors site et faire un exercice de restauration complet (base et médias).

Références techniques : [fichiers Node.js](https://nodejs.org/download/release/v24.18.0/docs/api/fs.html), [SHA-256 PostgreSQL 18](https://www.postgresql.org/docs/18/functions-binarystring.html).

## Accès public des fichiers

Publier une vitrine ne publie pas toute sa médiathèque. Une URL globale de photo doit être référencée par un produit actif d'une vitrine actuellement publique du même propriétaire. Un logo ou une bannière doit figurer dans la marque d'une telle vitrine. Les commerces indépendants publiés peuvent afficher ces images même lorsque le Workspace historique n'est pas publié ; l'abonnement du propriétaire doit rester valide. Une référence créée par un autre propriétaire ne donne aucun droit sur le fichier.

Le propriétaire conserve l'aperçu privé des images sans référence, avec `private, no-store`. Les photos de sections publiées restent servies par les endpoints dédiés à l'accueil et aux pages, après contrôle de publication et de référence. Sur un domaine boutique, seules les images de cette boutique sont permises, même si un autre magasin du même propriétaire est public. Les réponses globales publiques conservent un cache de 60 secondes : une copie déjà reçue peut subsister pendant ce délai après dépublication.
