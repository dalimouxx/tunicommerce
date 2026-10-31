# Déploiement de test sur Render

## État de cette livraison
Sources adaptées et compilées localement. Le dépôt GitHub et les ressources Render ne sont pas créés par ce dossier. La connexion au navigateur GitHub a expiré pendant la préparation ; le connecteur disponible peut éditer un dépôt existant mais ne propose pas sa création.

## 1. Dépôt GitHub
Créer un dépôt **privé** `tunicommerce` dans le compte `dalimouxx`, avec un README initial afin qu’une branche `main` existe. Autoriser ce dépôt dans le connecteur GitHub s’il est limité à une sélection de dépôts. Fournir ensuite son URL : les sources de ce dossier pourront y être transférées dans un commit cohérent.

Ne jamais écraser un dépôt existant d’un autre projet. Le site Sites actuel reste séparé.

## 2. Vérification GitHub Actions
Le workflow lance TypeScript, 39 tests locaux, les migrations, le build et 8 scénarios d’intégration avec PostgreSQL 18. Les scénarios d’intégration testent notamment l’initialisation concurrente, la connexion, les sessions, les en-têtes ChatGPT forgés, l’isolation et les mises à jour concurrentes.

Le workflow n’a pas encore été exécuté à distance. Attendre son résultat avant de considérer la base testée de bout en bout.

## 3. Blueprint Render
Depuis Render, créer un Blueprint à partir du dépôt et de `render.yaml`. L’espace identifié précédemment est « Dali Moussa's Workspace » ; confirmer cet espace au moment de créer les ressources. Le Blueprint prépare :

- `tunicommerce-test`, service Node.js, région Frankfurt, formule Free.
- `tunicommerce-test-db`, PostgreSQL 18, même région, formule Free, connexions publiques désactivées.
- `DATABASE_URL` lié à la connexion interne de la base.
- `SETUP_TOKEN` aléatoire généré par Render.
- Déploiement automatique après réussite des vérifications GitHub.

La construction exécute `npm ci --include=dev && npm run build`. Le démarrage applique `prisma migrate deploy` puis lance Next.js sur `0.0.0.0:$PORT`. Les migrations au démarrage évitent de dépendre d’une commande de pré-déploiement payante ; Prisma utilise son verrou de migration. Une migration échouée empêche le service de démarrer. Ne jamais remplacer cette commande par `db push --accept-data-loss` ou `migrate reset`.

Le Blueprint est validé contre le schéma JSON officiel Render récupéré le 30 octobre 2026. La validation Render CLI/API et la création réelle restent à effectuer. La CLI Render n’est pas disponible dans l’environnement de préparation.

## 4. Initialisation privée
Une fois le déploiement actif, ouvrir `/setup` sur l’URL du service. Récupérer SETUP_TOKEN dans les variables Render et le saisir directement dans le formulaire avec le nom, l’e-mail et le mot de passe du propriétaire. Ne pas envoyer ces valeurs dans le chat. Après création, se connecter sur `/login`.

`RENDER_EXTERNAL_URL` définit l’origine autorisée. Si un domaine personnalisé est ajouté, définir `APP_URL` sur son origine HTTPS exacte puis redéployer. Aucun en-tête de proxy fourni par le client n’est utilisé pour accorder l’accès.

## 5. Contrôle après déploiement
- `/api/health` répond 200 avec database=ok.
- Sans session, `/api/commerce` répond 401 et `/` redirige vers `/login`.
- Créer une commande, vérifier le stock, recharger la page et contrôler sa persistance.
- Tester une déconnexion, puis vérifier que l’ancienne session est refusée.
- Contrôler les logs sans y copier de mots de passe ou de chaînes de connexion.

## Limites de la formule Free
Documentation Render vérifiée le 30 octobre 2026 : le service web se met en veille après 15 minutes sans trafic ; la base PostgreSQL gratuite expire 30 jours après sa création. Cette configuration est destinée aux essais. Ne pas y conserver les seules copies de données commerciales. Si le compte a déjà consommé son quota gratuit, ne pas créer automatiquement une ressource payante : choisir ensemble une autre configuration.

Références : https://render.com/docs/blueprint-spec ; https://render.com/docs/free ; https://render.com/docs/environment-variables
