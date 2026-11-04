# TuniCommerce P1 — sauvegarde indépendante chiffrée (mise en service)

## Statut

Le code de sauvegarde et de restauration hors site est présent dans GitHub, mais **aucune
sauvegarde réelle n'est active tant que les secrets et un stockage privé
externe ne sont pas renseignés et vérifiés**. Le workflow quotidien est
volontairement inactif lorsque la variable GitHub
`P1_OFFSITE_BACKUP_ENABLED` n'est pas égale à `true`.

Cela ne change pas l'instance Render, la base Neon existante, les
abonnements ou les ressources payantes. Le snapshot Neon manuel ne devient pas
automatiquement une sauvegarde quotidienne.

## Choix du propriétaire et éléments requis

1. Disposer d'un compartiment **S3 compatible privé**, hors Neon et hors GitHub,
   avec versioning, durée de conservation et contrôle d'accès adaptés.
   Vérifier le coût réel de ce stockage et la législation applicable aux
   données clients avant d'autoriser des exports hors de Neon.
2. Créer des identifiants **limités au compartiment de sauvegarde** (écriture,
   head-object, et lecture pour restauration), jamais une clé administrateur
   générale. Prévoir la rotation et la révocation.
3. Créer une connexion PostgreSQL 18 dédiée à la sauvegarde en lecture seule
   avec privilèges adéquats sur les tables/séquences. Le mot de passe et l'URL
   ne doivent jamais être partagés dans une conversation ni écrits dans Git.
   Le paramètre `sslmode=require` ou plus strict est obligatoire.
4. Enregistrer les secrets suivants dans **GitHub → Settings → Secrets and
   variables → Actions → Secrets**, pas dans le dépôt :
   `P1_BACKUP_DATABASE_URL`,
   `P1_BACKUP_PASSPHRASE` (aléatoire, longueur >=32, à conserver aussi
   **hors GitHub** dans un coffre de récupération),
   `P1_S3_ENDPOINT` (URL HTTPS de l'API S3),
   `P1_S3_BUCKET`, `P1_S3_REGION`,
   `P1_S3_ACCESS_KEY_ID`, `P1_S3_SECRET_ACCESS_KEY`.
5. Exécuter manuellement **TuniCommerce P1 encrypted independent offsite backup**
   depuis l'onglet Actions. Le job refuse de continuer si la configuration
   n'est pas valide. Vérifier son succès et noter la clé d'objet renvoyée,
   sans télécharger le contenu sur l'ordinateur personnel.
6. Exécuter manuellement **TuniCommerce P1 isolated offsite restore drill**
   avec la clé d'objet produite. La commande restaure **uniquement** dans
   le conteneur PostgreSQL jetable du runner ; elle contrôle les tables
   User, Workspace, Shop et ShopCommerce et ne modifie pas Neon.
7. Après succès documenté du test, créer la variable GitHub Actions
   `P1_OFFSITE_BACKUP_ENABLED=true`. Ce choix active l'exécution quotidienne
   à 02:43 UTC. Désactiver la variable pour suspendre l'export.
   Le propriétaire doit activer les notifications d'échec du workflow et
   vérifier les objets réellement présents : un workflow « skipped » n'est
   jamais une sauvegarde.

## Garanties et limites du mécanisme

- `pg_dump` 18 streamé directement dans GPG AES-256 : **aucun dump en clair
  n'est écrit sur le disque du runner**. Contrôle de déchiffrement et table des
  matières avec `pg_restore --list` avant envoi.
- Copie privée envoyée par TLS et vérifiée côté stockage via `head-object`,
  sans artifacts GitHub ni sortie de données métier dans les logs.
- Chiffrement symétrique : **la perte de la phrase secrète rend les copies
  irrécupérables**. Une compromission du compte GitHub peut compromettre
  les secrets ; préférer un secret manager ou une clé publique hors CI si
  les risques l'exigent.
- L'exercice restaure dans un conteneur GitHub temporaire qui contient les
  données de la vraie sauvegarde. Vérifier les autorisations, la région et
  la politique de traitement des données avant le premier exercice.
- La vérification de quatre tables **n'est pas** une certification de chaque
  ligne, média, pièce jointe ou de la cohérence des transactions externes.
  Le test métier sur copie et un contrôle d'intégrité restent nécessaires.
- Aucun effacement automatique : configurer une politique de cycle de vie
  privée du fournisseur avec rétention (par exemple 30 jours quotidiens et
  copies hebdomadaires, selon besoins juridiques). Faire un test de
  restauration mensuel contrôlé.
- Le workflow GitHub planifié peut démarrer avec retard ou échouer ; le
  propriétaire doit surveiller les exécutions et les objets. Les objectifs
  RPO/RTO ne sont pas garantis tant qu'aucun essai réel n'a réussi.

## Retour arrière

Retirer ou passer à `false` `P1_OFFSITE_BACKUP_ENABLED` suspend
les futures sauvegardes. Cela ne supprime aucun objet déjà sauvegardé.
En cas de perte d'une clé, la révoquer puis configurer un nouveau secret ;
ne jamais coller les secrets dans une issue, une pull request ou une conversation.
