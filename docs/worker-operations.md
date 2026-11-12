# Exploitation du worker sur VPS

Le worker émet un signal PostgreSQL toutes les 30 secondes, avant de réclamer une tâche. `/admin/taches` présente le nombre de processus ayant émis un signal depuis moins de deux minutes, le dernier signal, les baux expirés et l'âge de la plus ancienne tâche disponible. L'autorisation superadministrateur précède la lecture. Aucun nom de machine, destinataire, contenu ou secret n'est enregistré dans le signal.

`npm run worker:health` est une sonde locale pour l'outil de supervision du VPS : code 0 si un worker est récent, aucun bail n'est expiré et aucune tâche disponible n'attend depuis quinze minutes ; 1 si ces conditions échouent ; 2 si la lecture échoue. Elle retourne uniquement des agrégats JSON. Les échecs terminaux restent visibles séparément : ils nécessitent une investigation même si le worker fonctionne. Ne pas exposer la sortie par un endpoint public. Le signal confirme une activité du processus, pas l'acceptation ou la réception d'un e-mail.

## Conservation automatique

Au démarrage puis toutes les heures, chaque worker supprime par lots d'au plus 500 lignes par catégorie :

- tâches SUCCEEDED, FAILED ou CANCELLED terminées depuis plus de 30 jours ;
- jetons de compte expirés depuis plus de 30 jours ;
- événements de sécurité de plus de 180 jours ;
- signaux de processus sans activité depuis plus de sept jours.
- événements externes de plus de trente jours.

Les tâches PROCESSING ne sont jamais purgées, ni les tâches sans date de fin. Les communications connues ACCOUNT_EMAIL, ORDER_EMAIL et BUSINESS_WEBHOOK restées PENDING plus de 48 heures échouent avec le code EXPIRED, sans envoi, et leur contenu est effacé. Les autres tâches en attente sont conservées. Chaque catégorie, y compris cette expiration, reste bornée à 500 lignes par passage ; la rétention rend les lignes éligibles au nettoyage et un retard peut subsister en cas de volume élevé. Deux workers peuvent nettoyer simultanément grâce aux verrous SKIP LOCKED et à une sélection matérialisée bornée. Les contenus des tâches restent effacés dès leur état terminal. La purge des métadonnées n'est pas une sauvegarde ; conserver la politique de sauvegarde et les exigences locales de conservation séparément. Les jetons ou codes TOTP encore utilisés ne sont pas supprimés par ce nettoyage.

## Installation à effectuer sur le futur VPS

Le fichier `deploy/vps/tunicom-worker.service` est un modèle, non installé et non activé sur Render. Adapter les chemins et le binaire Node au VPS choisi. Il suppose un utilisateur système sans connexion `tunicom`, une release lisible dans `/srv/tunicom/current`, ses dépendances de production et le client Prisma généré. Effectuer les migrations une seule fois pendant le déploiement avant de démarrer le web et le worker.

Placer les paramètres dans `/etc/tunicom/worker.env`, fichier propriétaire root de mode 600, lu par systemd. Utiliser la même DATABASE_URL, APP_URL HTTPS et APP_ENCRYPTION_SECRET que le web. Ne jamais inclure ce fichier de secrets dans Git. Le worker refuse de démarrer sans chiffrement ou configuration de base. Il ne réclame les tâches e-mail que si le SMTP est complet et les événements externes que si WEBHOOK_ALLOWED_HOSTS contient des hôtes autorisés. Sans canal configuré, il peut assurer le signal de présence et la maintenance sans envoyer ni consommer les tentatives de ces canaux. Voir `account-security-worker.md` et `business-webhooks.md`.

Après installation du modèle dans `/etc/systemd/system/`, recharger systemd, puis activer le service au moment où l'envoi a été autorisé et testé. `systemctl status tunicom-worker` et `journalctl -u tunicom-worker` permettent le diagnostic. Le redémarrage après échec est borné par systemd ; une alerte externe doit surveiller les sorties de la sonde. Ne pas journaliser les variables d'environnement ou les corps des e-mails.

L'arrêt SIGTERM attend le traitement courant (délais SMTP et HTTPS bornés), puis marque le processus arrêté. Après un crash, le signal devient périmé et le bail de tâche peut être repris au bout de 90 secondes. Tester un arrêt/redémarrage et la réception sur une destination de recette explicitement autorisée avant ouverture commerciale. Aucun prestataire, serveur VPS, moniteur ou envoi réel n'est activé par ces fichiers.
