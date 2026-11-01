# TuniCommerce — Espace équipe isolé

## Principe
Le système commercial existant (`Workspace` JSON, commandes, produits, clients, caisse, boutique publique et tableau de bord) reste inchangé. Le nouvel espace équipe est une fonctionnalité **additive et facultative**. Il ne donne pas encore accès aux données commerciales héritées par simple appartenance à une équipe : les API commerciales historiques continuent à vérifier l'utilisateur propriétaire, comme auparavant.

## Modèle
`ShopInvitation` : clé `(shopId,email)` unique, rôle non propriétaire, initiateur, création, expiration après 7 jours, date d'acceptation et date de révocation. Une invitation ne contient ni mot de passe ni jeton réutilisable. Le compte connecté ne peut accepter que l'invitation correspondant exactement à son adresse e-mail. La transaction d'acceptation réserve l'invitation par comparaison atomique et crée ou réactive son adhésion à la boutique.

## API indépendantes
- `GET /api/v1/invitations` : invitations non expirées de l'utilisateur connecté.
- `POST /api/v1/invitations/:invitationId/accept` : accepter une invitation une seule fois.
- `GET /api/v1/shops/:shopId/invitations` : liste réservée au propriétaire ou administrateur de la boutique.
- `POST /api/v1/shops/:shopId/invitations` : invitation `{email,role}` avec contrôle de rôle.
- `POST /api/v1/shops/:shopId/invitations/:invitationId/revoke` : révoquer une invitation en attente.
- `PATCH /api/v1/shops/:shopId/members/:memberId` : `{action:"setRole",role}` ou `{action:"setActive",active}`.
- `/equipe` : écran responsive de gestion d'équipe, indépendant de l'ancienne navigation.

## Sécurité
- Session HTTP-only existante obligatoire ; origine contrôlée sur chaque écriture.
- Tous les accès de gestion sont filtrés par `shopId` **et** appartenance active de l'utilisateur.
- Le rôle OWNER et son accès sont immuables dans cette phase.
- Un ADMIN ne peut ni attribuer le rôle ADMIN, ni modifier un autre ADMIN.
- Les invitations sont visibles **uniquement dans l'application** après connexion. Aucun envoi automatique d'e-mail n'est effectué et **aucun nouveau compte n'est créé** : l'invité doit disposer d'un compte TuniCommerce pour accepter.
- L'acceptation concurrente ne doit pas produire plusieurs adhésions.

## Vérifications et mise en service
Une migration additive crée seulement `ShopInvitation` et son index, sans modifier `Workspace`. Le workflow `team-regression.yml` travaille sur une base PostgreSQL 18 éphémère, vérifie TypeScript, validation, migration, build et scénarios HTTP, y compris l'isolation inter-boutiques et la compatibilité du commerce hérité.

**Attention :** cette branche n'est pas déployée sur Render et aucune migration Neon n'est appliquée. Ne pas activer la fonctionnalité en production sans revue des tests et procédure de déploiement contrôlé.
