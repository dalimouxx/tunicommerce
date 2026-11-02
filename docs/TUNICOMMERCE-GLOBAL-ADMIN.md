# TuniCommerce — Centre de contrôle SaaS, phase 1

## Accès

- `/admin` : **vue globale** (marchands, espaces commerciaux, boutiques publiées, organisations, alertes abonnements/liaisons et recherche)
- `/admin/marchands` : annuaire des comptes marchands, liens vers leur fiche boutique et situation de leur équipe
- `/admin/gestion-boutiques` : création d'un marchand avec son organisation et sa boutique, gestion manuelle de la formule, de l'échéance et de la publication. Rechercher et sélectionner **une** boutique pour l'éditer.
- `/admin/abonnements` : listes et filtres pour les essais actifs, expirations proches, suspensions et expirations
- `/admin/boutiques/{workspaceId}` : fiche de supervision, propriétaire, abonnement, catalogue et commandes **agrégés**, état des médias et historique administratif
- `/admin/journal` : jusqu'à 100 événements globaux enregistrés
- `/marchand` : espace **personnel** du marchand ou du super-admin propriétaire, strictement séparé des opérations de la plateforme.

## Statistiques

Les compteurs de base sont des requêtes PostgreSQL sur l'ensemble des lignes ; les **listes** sont limitées aux 120–200 plus récentes (selon la page), clairement signalées. Ceci est une première version, non une table paginée exhaustive.

Une boutique « accessible » requiert une publication demandée, un statut TRIAL ou ACTIVE et une date de fin supérieure à l'heure courante. Une boutique suspendue ou expirée n'est **pas** accessible aux acheteurs, même si le drapeau `published` reste vrai.

Les montants du détail boutique concernent des commandes livrées en TND et ne constituent ni le chiffre d'affaires de TuniCommerce ni une facture SaaS.

## Gestion des marchands

Lorsqu'un marchand est créé depuis `/admin/gestion-boutiques`, la transaction PostgreSQL crée désormais :
1. Le compte User (rôle `MERCHANT`, mot de passe haché).
2. Le Workspace commercial indépendant (catalogue, commandes, stocks).
3. L'Organization liée au marchand.
4. Le Shop lié au Workspace (identité publique).
5. La Membership du propriétaire (rôle `OWNER`).
6. L'événement d'audit de création.

Aucune donnée historique n'est remplacée. Les comptes existants non reliés conservent leur Workspace. Le super-admin peut cliquer sur **Relier l'organisation et le propriétaire** pour activer explicitement leur organisation et leur Membership sans modifier `Workspace.data`.

Une mise à jour du slug ou de la publication depuis l'administration synchronise également le Shop relationnel lorsqu'il est déjà lié. Les collisions de slug réservées par d'autres Shops sont rejetées.

## Limites de cette première phase

- Les plans STARTER/PRO/BUSINESS restent des **catégories administratives**. Les prix TND, limites par plan, droits d'accès et modules premium ne sont pas encore configurables ni appliqués automatiquement.
- Les changements de formule ou de date sont **manuels** : aucun paiement SaaS, facture d'abonnement, notification de renouvellement, reçu ou prélèvement n'est émis.
- Les listes d'administration affichent un aperçu borné ; elles doivent être remplacées par une pagination serveur et des filtres SQL quand le nombre de marchands augmente.
- Les détails des commandes et clients restent dans l'espace privé marchand, par choix de confidentialité. Les fonctions d'assistance/impersonation nécessiteront des autorisations explicites, une traçabilité et des restrictions fortes.
- Le journal couvre les opérations actuellement enregistrées via PlatformAudit ; il ne remplace pas un système d'observabilité, de logs de connexion et d'alertes de sécurité.

## Vérification

Le workflow `.github/workflows/admin-control-center.yml` utilise PostgreSQL isolé, lance migration deux fois, typecheck, compilation et tests HTTP d'administration. Ces tests contrôlent la séparation admin/marchand, création transactionnelle des ressources, synchronisation slug/publication, résolution des collisions, liaison opt-in des anciennes boutiques, conservation du JSON commercial et historique d'audit.

**Prochaines phases proposées :**
1. Catalogue de plans configurables, quotas et entitlements serveur par boutique (FREE/STARTER/PRO/BUSINESS/AGENCY).
2. Paiements SaaS, essais, relances d'échéance, factures TND et vérification des transactions.
3. Pagination serveur, filtres, export contrôlé, supervision des boutiques en anomalie.
4. Centre de support, tickets, permissions d'assistance temporaires et journal d'accès détaillé.
5. KPI SaaS réels : acquisition, activation, boutiques payantes, revenus récurrents et désabonnements.
