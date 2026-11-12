# Comptes et tâches de sécurité

Ce lot ajoute la récupération de mot de passe, la vérification d'adresse e-mail, la double authentification TOTP et une file PostgreSQL dédiée aux e-mails de sécurité. Il n'active aucun prestataire ni envoi sur les environnements hébergés.

## Préparer l'environnement

1. Utiliser Node.js 22.13 ou ultérieur dans la plage du `package.json`, installer avec `npm ci`, générer Prisma et appliquer les migrations avec `npm run db:migrate`.
2. Configurer la même `DATABASE_URL`, le même `APP_URL` canonique et le même `APP_ENCRYPTION_SECRET` pour le serveur web et le worker. En production, `APP_URL` doit être l'URL HTTPS officielle.
3. Générer le secret de chiffrement côté serveur avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Le conserver dans le gestionnaire de secrets et dans les sauvegardes sécurisées, jamais dans Git ni dans un formulaire marchand.
4. Une fois un service d'e-mail choisi, renseigner `SMTP_HOST`, `SMTP_PORT` (465 ou 587), `SMTP_USER`, `SMTP_PASSWORD` et `MAIL_FROM`. Le domaine expéditeur doit être autorisé par le prestataire. Ne pas utiliser de destinataires réels pour les premiers essais.
5. Construire le serveur avec `npm run build`. Lancer séparément le serveur web avec `npm start` et le processus de traitement avec `npm run worker`. Le web ne lance pas implicitement de worker.

Le worker TypeScript utilise `tsx`, inclus dans les dépendances de production. Il faut embarquer `scripts/worker.ts`, les modules serveur et le client Prisma généré ; un paquet contenant uniquement `.next/standalone` ne suffit pas. Un futur service hébergé devra être configuré explicitement. Le présent lot ne modifie pas l'infrastructure Render.

Sans configuration SMTP complète, l'écran de récupération signale l'indisponibilité et l'API retourne 503 sans créer de jeton. Sans clé de chiffrement, l'activation TOTP est indisponible. Une configuration renseignée ne prouve ni la délivrabilité des e-mails ni le fonctionnement d'un worker.

Le worker peut désormais démarrer pour la maintenance et les autres canaux sans SMTP. Il ne réclame les tâches ACCOUNT_EMAIL et ORDER_EMAIL que lorsque le SMTP est complet ; leur indisponibilité ne consomme pas de tentative d'envoi. Les communications restées en attente plus de 48 heures expirent sans envoi lors de la maintenance. Les vérifications de jeton et de destinataire avant chaque envoi restent inchangées.

## Parcours et protections

- `/compte/recuperer` enregistre une demande avec une réponse identique pour une adresse connue ou inconnue. Les limites persistantes couvrent le volume global et chaque adresse, y compris quand plusieurs serveurs web fonctionnent ensemble.
- Les jetons aléatoires sont stockés sous forme de condensat. Ils expirent après 30 minutes pour un changement de mot de passe, 24 heures pour une vérification. Une nouvelle demande invalide l'ancien jeton de même type. La consommation exige un POST explicite ; ouvrir le lien seul ne le consomme pas.
- Le jeton est dans le fragment du lien, effacé de la barre d'adresse après lecture par l'écran. Les pages et API de compte demandent `no-store`, `no-referrer` et l'exclusion des moteurs de recherche. Ne pas journaliser les corps de requêtes de ces API.
- Un changement de mot de passe révoque toutes les sessions. Le numéro de version d'authentification protège également contre une création tardive de session à partir d'une authentification antérieure.
- `/compte/securite` permet de vérifier son adresse et de gérer son propre TOTP. Le portail d'administration utilise `?portail=ADMIN` et son cookie distinct. Une vérification d'e-mail ne débloque pas automatiquement une souscription et n'est pas rendue obligatoire pour les comptes existants.
- L'activation TOTP exige le mot de passe et un code courant. Les codes déjà consommés ne sont pas réutilisables. Dix codes de secours sont affichés une seule fois ; leurs condensats sont conservés en base. Renouveler les codes ou désactiver TOTP exige le mot de passe et un second facteur. Les autres sessions sont révoquées.
- La récupération par e-mail conserve TOTP. Si l'utilisateur perd à la fois son application et ses codes de secours, aucun contournement automatique par e-mail n'est fourni.

## Exécution, incidents et conservation

Les tâches sont insérées dans la même transaction que le jeton. Leur contenu est chiffré avec AES-256-GCM et lié à l'identifiant de tâche ; les secrets TOTP utilisent un contexte distinct lié au compte. Une clé incorrecte empêche le déchiffrement. Une rotation doit donc prévoir une migration des contenus actifs ; remplacer simplement la variable rendrait les secrets TOTP existants inutilisables. Une stratégie de rotation à plusieurs clés reste à développer.

Chaque worker réclame atomiquement une tâche avec `SKIP LOCKED`, un bail de 90 secondes et un identifiant de bail. Après arrêt brutal, un autre worker peut reprendre le bail expiré. Une ancienne exécution ne peut pas acquitter le nouveau bail. Les échecs SMTP sont réessayés au plus quatre fois, avec attente croissante ; les contenus invalides ou expirés échouent immédiatement. L'arrêt SIGTERM/SIGINT cesse de réclamer de nouvelles tâches et laisse finir l'envoi en cours.

Le transport impose TLS sur 465 ou STARTTLS sur 587, vérifie les certificats et borne les délais réseau. Un identifiant de message stable est utilisé pour les reprises. La livraison est **au moins une fois** : une coupure après acceptation SMTP et avant acquittement PostgreSQL peut provoquer un doublon. Un identifiant stable ne garantit pas la déduplication chez tous les prestataires. Le lien reste à usage unique et le worker vérifie sa validité avant chaque tentative. Une demande remplacée pendant un envoi déjà commencé peut produire un e-mail contenant un lien invalidé.

Les contenus chiffrés sont effacés après succès, annulation ou échec terminal. Les métadonnées des tâches terminées sont purgées après 30 jours, les événements de sécurité après 180 jours, par lots bornés exécutés par le worker. Les tâches échouées n'ont pas de bouton de relance avec conservation de lien : l'utilisateur peut demander un nouveau lien, sous réserve des limites de tentatives.

`/admin/taches` est réservé au superadministrateur et présente les 50 dernières tâches avec état, nombre de tentatives et code d'erreur limité. Cette vue ne publie ni adresse de destinataire, ni contenu, ni jeton, ni secret SMTP. Elle présente maintenant les signaux de présence des workers et les tâches bloquées. La sonde locale et le modèle systemd sont décrits dans `worker-operations.md` ; la configuration d'alertes sur le futur VPS reste à effectuer.

## Validation

Les tests utilisent exclusivement une base PostgreSQL locale jetable dont le nom termine par `_test`, un hôte SMTP fictif et une fonction d'envoi injectée. Aucun vrai e-mail n'est envoyé. Ils couvrent les liens à usage unique, les changements concurrents, l'expiration, la séparation des comptes et portails, les sessions révoquées, les codes TOTP et de secours, les baux concurrents et les limites de reprise. Les vecteurs TOTP sont ceux de l'annexe B de la RFC 6238.

Les essais avec un véritable prestataire SMTP, la délivrabilité, les arrêts de processus sur l'hébergeur et le contrôle visuel sur appareils restent à effectuer avant ouverture de ces fonctions en production.
