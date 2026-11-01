## v0.7 — Comptes clients

Inscription client, connexion et historique des commandes sur plusieurs appareils (`/compte`). Les nouvelles commandes passées avec une session CUSTOMER sont rattachées côté serveur ; aucun rattachement par téléphone/e-mail ou reprise automatique des commandes invitées. Les clients ne peuvent pas accéder aux API marchand/admin. Les liens privés de suivi restent utilisables et doivent rester confidentiels.

Migration additive `202611010001_customers` : relation facultative PublicReceipt → User, index chronologique. Les anciens reçus restent inchangés. Inscription sans validation e-mail ni récupération de mot de passe pour le moment ; aucune notification automatique. Le panier reste local au navigateur. Aucun nouveau service payant.

# TuniCommerce — GitHub / Render (0.4.0)

Version autonome de l’application de test : React / Next.js sur Node.js, PostgreSQL et Prisma. Le code métier de la version privée 0.3 est conservé. Cette livraison prépare le transfert hors de Sites ; elle ne constitue pas encore le SaaS complet du cahier des charges.

## Fonctionnalités conservées
Catalogue, stock, commandes, clients, call center simple, zones et tarifs, transporteurs manuels, COD, dépenses, coupons, panier privé, retours partiels, remboursements enregistrés, factures commerciales, statistiques et audit.

## Nouveau socle
- Connexion e-mail / mot de passe indépendante de ChatGPT.
- Création unique du propriétaire, protégée par SETUP_TOKEN.
- Mots de passe scrypt avec sel aléatoire ; sessions aléatoires de 256 bits dont seul le condensat est stocké.
- Cookies HttpOnly, Secure en production, SameSite=Lax ; expiration à 7 jours et révocation à la déconnexion.
- Contrôle Origin pour toutes les mutations et limitation persistante des tentatives de connexion.
- PostgreSQL avec migrations Prisma ; mises à jour atomiques conditionnées par propriétaire et version.
- Workflow GitHub Actions et Blueprint Render.

## Démarrage local
Node.js 22.13+ (22 ou 24) et PostgreSQL sont nécessaires.

```sh
npm ci
cp .env.example .env
# Renseigner DATABASE_URL, APP_URL et une clé SETUP_TOKEN aléatoire.
npm run db:generate
npm run db:migrate
npm run dev
```

Ouvrir `/setup`, saisir la clé SETUP_TOKEN et choisir le compte propriétaire (mot de passe d’au moins 12 caractères). Cette clé ne doit jamais être partagée dans le chat ou ajoutée au dépôt. Une fois le propriétaire créé, l’initialisation est verrouillée en base ; elle ne crée pas de deuxième compte. La connexion se fait ensuite sur `/login`.

Pour un lancement local du build de production, HTTPS est requis. Le mode `npm run dev` accepte `APP_URL=http://localhost:3000`. Render fournit automatiquement son URL HTTPS.

## GitHub et Render
Voir [DEPLOYMENT.md](DEPLOYMENT.md). Le Blueprint définit un service web de test et une base PostgreSQL, tous deux en formule Free. Leur disponibilité dépend du compte Render. Aucune ressource distante n’est créée par l’archive seule.

Le dépôt GitHub doit contenir tous les fichiers de ce dossier à sa racine. Ne pas y ajouter `node_modules`, `.next`, des fichiers `.env`, des sauvegardes de données ou des secrets. `package-lock.json`, `prisma/migrations`, `render.yaml` et `.github/workflows/ci.yml` doivent être suivis.

## Vérification
```sh
npm run typecheck
npm test
npm run build
# Base dédiée se terminant par _test : le test efface son contenu.
TEST_DATABASE_URL=postgresql://.../tunicommerce_test npm run test:integration
```
Pour les tests d’intégration, appliquer d’abord les migrations à cette base via `DATABASE_URL=postgresql://.../tunicommerce_test npm run db:migrate`. Le workflow CI configure ces étapes avec PostgreSQL 18. Les identifiants PostgreSQL présents dans ce workflow sont uniquement ceux du conteneur éphémère de CI.

## Limites
Un propriétaire et une boutique par instance de test. Pas d’inscription publique, de récupération de mot de passe par e-mail, de MFA, d’équipe/RBAC ni de boutique publique. Les transporteurs, messageries, publicités et IA ne sont pas connectés. Les factures ne sont pas encore des factures fiscales validées.

Les données métier restent un agrégat JSON versionné dans PostgreSQL. Les comptes, sessions et compteurs de sécurité ont leurs tables relationnelles ; la normalisation complète des produits, commandes, stocks et organisations reste à réaliser avant la montée en charge. La migration technique vers PostgreSQL/Prisma ne signifie donc pas que l’architecture SaaS complète est terminée.

Les données de l’ancien site ne sont pas copiées automatiquement : cette nouvelle instance commence avec les données fictives signalées. Aucun contenu réel du site privé n’a été extrait. Préparer un export/import contrôlé si des données réelles doivent être transférées.

La limitation des connexions est globale à cette instance de test (20 tentatives/10 minutes), ce qui peut temporairement bloquer un utilisateur légitime ; une stratégie multi-utilisateurs plus fine sera nécessaire pour le SaaS.

## Version 0.5 — boutiques publiques et administration

- `/` : espace marchand protégé, lié exclusivement à son propre workspace.
- `/boutiques` : annuaire public ; `/boutiques/{slug}` : catalogue, panier, commande sans compte et paiement à la livraison.
- `/admin` : superadministrateur ; création des marchands et boutiques, lien public, publication, offre, statut et échéance d’abonnement, historique des changements.

Le compte de première installation devient superadministrateur lors de la migration. Les nouveaux comptes créés par l’administration restent marchands. Les boutiques existantes restent non publiées jusqu’à la configuration de leur lien et de leur échéance par l’administrateur. Une boutique publiée nécessite un abonnement `TRIAL` ou `ACTIVE` avec une date future pour recevoir des commandes. Une suspension, une résiliation ou une expiration bloque immédiatement la page publique et les commandes côté serveur.

Les offres STARTER / PRO / BUSINESS sont des catégories administratives sans quotas distincts. La facturation, les prélèvements automatiques, les comptes clients, la récupération de mot de passe par e-mail et le suivi public de livraison ne sont pas implémentés. Le client commande sans créer de compte. Les nouvelles boutiques sont vides ; le marchand ajoute son catalogue.

La réponse publique est construite par liste blanche : aucun coût d’achat, client existant, commande ou historique interne n’est envoyé. Le serveur recalcule les montants, réserve le stock sous verrou PostgreSQL et déduplique les tentatives avec une clé de requête. Le catalogue de démonstration est explicitement signalé.

## Version 0.6 — catalogue et suivi client

Les produits acceptent une description et une photo par lien HTTPS. Les réglages de boutique proposent présentation, logo et bannière (liens HTTPS). Les articles de même nom et catégorie sont regroupés en variantes dans le catalogue ; chaque SKU conserve son prix et son stock. Le panier est mémorisé par boutique dans le navigateur, sans enregistrer les coordonnées du client. Les liens des dix dernières commandes sont conservés sur cet appareil et peuvent être effacés.

Les nouvelles commandes publiques disposent d’un lien privé `/suivi/{jeton}` avec un jeton aléatoire de 256 bits. Ce lien expose uniquement les articles, montants, statut, transporteur et échanges client prévus ; jamais les coordonnées du client ni les notes internes. Il permet de demander une annulation avant expédition ou un retour après livraison. Les marchands voient les demandes en attente et peuvent répondre. Accepter une annulation annule la commande et restitue le stock une seule fois. Accepter un retour n’effectue aucun remboursement ou mouvement de stock ; les modules Retours existants gèrent la réception et le remboursement.

Limites : pas encore de téléversement de photos, de compte client synchronisé entre appareils ou de notifications e-mail/SMS. Les liens privés doivent être conservés et ne pas être partagés. Les anciennes commandes ne reçoivent pas rétroactivement de lien de suivi.
