# TuniCommerce — Moteur des offres SaaS : première version

## Pages disponibles

- `/admin/plans` : catalogue configurable des offres SaaS : code, nom, description, prix en TND, durée en jours, activation/désactivation, quotas produits, commandes mensuelles et photos.
- `/admin/gestion-boutiques` : attribution des offres **activées** lors de la création ou mise à jour des boutiques.
- `/admin/boutiques/{workspaceId}` : exceptions individuelles de quotas, avec justification et audit.
- `/mon-abonnement` : compte marchand, formule, échéance et utilisation réelle des quotas.
- `/admin/abonnements` : suivi des dates et statuts déjà présents, avec lien vers le catalogue.

## Compatibilité et sécurité

Migration additive `202611020001_saas_plans` créant `SubscriptionPlan`, `WorkspacePlanOverride` et `SubscriptionPlanAudit`.
Les cinq codes commerciaux FREE, STARTER, PRO, BUSINESS et AGENCY sont insérés comme **brouillons tarifaires**. Prix initial **0** = à configurer ; limites initiales **NULL** = non limitées. Ne jamais annoncer que ces tarifs sont définitifs.

Les lignes existantes de `Workspace`, `Shop`, `User` et leurs historiques commerciaux restent inchangés : aucun rétroremplissage destructif ni prélèvement automatique.

Chaque mise à jour d'offre est journalisée avec auteur, ancienne configuration et nouvelle configuration. Les exceptions par boutique sont journalisées dans `PlatformAudit`.

Les actions d'administration sont limitées à ADMIN, validées par Zod et protégées contre les requêtes d'origine externe (CSRF). Une offre attribuée à une boutique ne peut pas être désactivée sans réaffectation préalable.

## Quotas **réellement appliqués** côté serveur

- **Produits** : ajout de produit via `POST /api/commerce`, contrôle après calcul dans la boucle de sauvegarde CAS. Les mises à jour et stocks existants restent possibles au-dessus du plafond.
- **Commandes mensuelles** : création manuelle via `POST /api/commerce` et paiement à la livraison via `POST /api/boutiques/[slug]/checkout`. Les commandes mensuelles correspondent au mois civil dans le fuseau `Africa/Tunis`; refus HTTP 409 à partir du plafond. Les retours, annulations et modifications de commandes existantes ne suppriment pas l'historique et ne sont pas bloqués.
- **Photos produits** : upload/galerie avec limite de plan appliquée sous verrou transactionnel. Il reste toujours un plafond technique de **30 photos par boutique**, quel que soit le plan.
- Une **exception individuelle** remplace la valeur du plan : champ vide = hérite ; nombre positif = plafond ; 0 = illimité (dans la limite technique de 30 photos). Les exceptions existantes peuvent être modifiées depuis la fiche de boutique.
- Sur une offre non configurée, les plafonds produits et commandes sont illimités et la médiathèque conserve son ancien plafond technique de 30 photos.
- Abaisser un plafond n'efface **jamais** les produits, photos ou commandes existantes.

## Configurations anticipées, **non encore appliquées**

- Limites du nombre de boutiques et d'employés.
- Indicateurs de fonctionnalités : Call Center, marketing, rapports, IA, domaine personnalisé, multi-boutique.
- Durée de référence de l'offre : enregistrée pour tarification ; **ne renouvelle pas automatiquement** les abonnements en cours.

Ces champs sont préparés dans le catalogue, mais ne contrôlent pas encore les permissions et ne doivent pas être vendus comme des fonctions SaaS opérationnelles.

## Facturation **pas encore implémentée**

Le prix saisi dans l'administration n'est qu'un tarif de référence. Aucun paiement par carte, D17, virement bancaire ou transfert n'est collecté automatiquement. Aucun débit, reçu fiscal, relance de paiement ou transaction n'est créé.

L'étape suivante est le cycle d'abonnement : souscription du marchand, émission de facture SaaS, validation d'un paiement hors ligne (D17/virement/espèces), renouvellement, notifications, historique des factures, puis éventuellement passerelle de paiement.

## Tests

La suite `tests/saas-plan-api.test.ts` sur une base PostgreSQL `*_test` indépendante valide :
- Accès admin exclusif et protection CSRF.
- Création, tarification, journal de modifications et désactivation des plans utilisés.
- Attribution d'un plan personnalisé à un marchand.
- Quotas produits, modifications sans perte, limites photo et affichage dans la galerie.
- Première commande COD acceptée, commande suivante rejetée sans mutation de stock.
- Exceptions individuelles, permissions et audit.
- Respect des anciens plafonds non configurés.

Le workflow GitHub `.github/workflows/saas-plan-engine.yml` exécute typecheck, migration répétable, build et cette batterie de tests.

## Reste à développer

1. Paiements et facturation des abonnements, renouvellement et suspension commerciale.
2. Quotas sur le véritable multi-boutique et sur les employés (les champs de plan existent seulement).
3. Permission-gating des modules et limitations par rôle.
4. Abonnement modifiable par le marchand, notification des dates de fin, et historique des transactions.
5. Validations supplémentaires en situation réelle avant la commercialisation.
