# Audit des accès et parcours Tunicom — 11 novembre 2026

La vitrine d'une boutique publiée est accessible aux clients. Les brouillons, les tableaux de bord, les commandes, les clients, les finances et l'administration SaaS utilisent des autorisations serveur distinctes. Une URL de connexion visible ne donne pas accès à son administration.

## Corrections

- Les dix-sept pages administratives contrôlent leur propre session Super Admin avant de charger leurs données. Elles ne dépendent plus uniquement du layout parent, dont le rendu peut être concurrent.
- La connexion principale et l'ancien chemin `/login` conduisent directement à la connexion marchand. Le formulaire marchand et son tableau de bord ne proposent plus d'entrée Super Admin. La connexion administrative reste à `/connexion/admin`.
- Le formulaire d'installation initiale est inaccessible après création du premier Super Admin. Le verrou et la clé serveur continuent de protéger son API.
- L'API commerciale exige un espace réellement possédé. Sa lecture ne crée plus implicitement de boutique. Un collaborateur sans espace propriétaire ne reçoit plus de boutique fantôme.
- Le tableau de bord affiche un chargement privé, puis les données du compte, ou un état d'erreur avec nouvelle tentative. Il n'affiche plus de catalogue de démonstration en remplacement des données indisponibles. Une réponse d'accès refusé supprime les données affichées.
- Les redirections des pages marchandes convergent vers le même portail. Une déconnexion marchand est accessible depuis « Mes boutiques » et conserve la séparation des sessions.
- Les pages et API privées reçoivent des en-têtes anti-cache, anti-indexation et de confidentialité du référent. Les anciens thèmes et les données commerciales sont conservés.

## Couverture automatisée

`scripts/application-route-inventory.mjs` recense les pages et les méthodes HTTP depuis les fichiers de routes. La nouvelle suite `tests/platform-route-audit.test.ts` est exécutée avec les autres suites d'intégration, en série sur une base PostgreSQL jetable dont le nom termine par `_test`.

L'inventaire comprend 54 modèles de pages, 71 routes API, 35 modèles de pages privées et 83 méthodes d'API protégées. Il couvre l'accès anonyme HTML et RSC, les pages administratives autorisées et refusées, les pages marchandes autorisées, les requêtes de mutation provenant d'une origine étrangère, les accès d'un autre marchand, les sessions révoquées ou expirées, les faux noms de cookies, les brouillons privés et les liens internes rendus. Les suites métier existantes vérifient aussi les commandes, le stock, les paiements COD, les abonnements, les médias, les pages, les équipes et la conservation des données.

```sh
npm run build
npm test
# Sur une base locale jetable uniquement, avec DATABASE_URL = TEST_DATABASE_URL :
npm run test:integration:all
# Vérification sans session, sans écriture, limitée au service Render de test :
node scripts/platform-public-audit.mjs
```

Les anciens tests qui créaient une boutique par une lecture HTTP préparent maintenant explicitement leur boutique fictive. Les tests de chargement SSR attendent l'écran privé, et non un tableau de bord de démonstration avant l'arrivée des données.

## Hébergement et limites

Le service existant utilise le runtime Node natif de Render, sans Dockerfile ni Docker Compose dans ce dépôt. Le build et le démarrage, les migrations et PostgreSQL sont vérifiés. Les workflows GitHub utilisent PostgreSQL 18 en conteneur ; ceci ne constitue pas une certification Docker de l'application.

`render.yaml` prévoit `/api/health`, qui vérifie le serveur et la base de données. Le service Render existant utilise encore une sonde TCP : son champ « Health Check Path » reste à régler sur `/api/health` dans le tableau de bord. Le connecteur de cette session ne propose pas de mise à jour de ce champ et le navigateur de contrôle est indisponible. Aucun forfait ni service externe supplémentaire n'est activé.

Le test visuel interactif n'a pas pu être exécuté dans cette session, en raison de l'indisponibilité du navigateur. Les tests HTTP fonctionnent sur le serveur de production compilé. Les prestataires réels de paiement, livraison, SMTP, SMS/WhatsApp et leurs parcours externes restent à choisir, configurer et tester. Cet audit ne remplace pas un test d'intrusion indépendant ni un test de charge en conditions réelles.
