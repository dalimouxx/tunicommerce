# TuniCommerce — Architecture cible et feuille de route

Date: 2026-11-01. Document de conception basé sur le cahier des charges transmis par le porteur du projet (61 sections).

## Mission
Créer → Vendre → Confirmer → Préparer → Livrer → Encaisser → Analyser → Optimiser.

## Principes non négociables
- Multi-tenant : Organization → Shop → Membership, avec contrôle d'accès par shopId sur toutes les opérations métier.
- Contrôle des rôles et permissions granulaires, refus par défaut, tests d'accès inter-boutiques.
- PostgreSQL/Prisma, migrations versionnées, transactions pour stocks, coupons, checkout, paiements et COD.
- Idempotence sur checkout, expédition, paiement et webhooks; audit append-only des actions sensibles.
- Montants stockés en unités monétaires exactes (millimes TND ou Decimal) et calculés exclusivement côté serveur.
- Internationalisation FR/AR, RTL, interface desktop back-office et mobile-first checkout.
- Intégrations externes réelles uniquement; afficher non connecté en l'absence de configuration.
- Aucun revenu COD considéré encaissé avant preuve de règlement; distinguer revenu livré, COD attendu et COD reçu.
- Protection des données personnelles et minimisation des données pour le score client transparent et contestable.

## Architecture de transition
Conserver Next.js 16 + React 19 + TypeScript + Prisma 7, modules métier séparés, API versionnée. Ne pas introduire Express/Fastify tant que le besoin de déploiement séparé n'est pas démontré.

Modules cibles : auth, organizations, shops, memberships, permissions, products, variants, inventory, stock-locations, customers, orders, order-events, call-center, cart, checkout, coupons, delivery-zones, carriers, shipments, returns, exchanges, finance, cod-settlements, invoices, expenses, analytics, automations, notifications, integrations, webhooks, ai, platform-billing.

Chaque module : schémas Zod, services, repository, permissions, routes, tests. Aucune logique métier critique uniquement dans les composants UI.

## Évolution du modèle de données
Le modèle actuel Workspace.data (JSON) ne doit pas être supprimé brutalement. Introduire des tables relationnelles tenant-scoped en migrations additives; prévoir backfill, double lecture contrôlée si nécessaire, vérification de parité, puis bascule progressive. Conserver la compatibilité des boutiques existantes.

Entités de départ : Organization, Shop, Membership, Role, Permission, Product, ProductVariant, StockLocation, StockMovement, Customer, Order, OrderItem, OrderEvent, CartSession, CartItem, Coupon, Shipment, ReturnRequest, CODSettlement, Expense, AuditLog, IdempotencyKey.

## Phases
1. Stabilisation, sécurité, CI, tests et migrations.
2. Organisations/boutiques/membres/RBAC et isolation.
3. Produits, variantes, inventaire transactionnel et multi-stock.
4. Clients, commandes, checkout COD, coupons et idempotence.
5. Call-center, notifications, rappels et intégrations configurables.
6. Livraison, transporteurs, retours, échanges et rapprochement COD.
7. Finance, factures, profit réel, analytique et publicité.
8. Store builder, abonnements, automations, API/webhooks et IA.

## Critères de validation
- Une boutique A ne peut ni lire ni modifier les données de B, y compris via IDs directs.
- Deux checkouts simultanés ne peuvent pas vendre plus que le stock disponible.
- Retry d'un checkout avec la même clé ne crée pas deux commandes.
- Annulation/retour génèrent des mouvements de stock traçables et non doublés.
- Chaque transition de commande est validée et journalisée.
- Les rapprochements COD distinguent attendu/reçu/écart et identifient les commandes concernées.
- CI : typecheck, tests, build et intégration PostgreSQL réussis avant fusion.
- Aucun secret ou donnée de client réelle dans les seeds, journaux ou fixtures.

## Sécurité de déploiement
Développer sur audit/stabilisation-2026-11 puis branches de fonctionnalités, ouvrir PR, valider CI, ne fusionner ni migrer la base principale sans vérification et sauvegarde préalable.

## Domaines des boutiques — code livré, activation VPS à réaliser

`ShopDomainClaim` conserve les demandes et preuves TXT ; `ShopDomainBinding` assure l'unicité globale des domaines vérifiés. La gestion appartient au propriétaire de la boutique indépendante. Le Proxy Next associe le véritable Host à une seule boutique et refuse les routes privées et les autres boutiques. Les commandes restent validées côté serveur avec une origine HTTPS correspondant à cette boutique. Les sous-domaines automatiques utilisent le slug sous une racine réservée à l'exploitant.

Le routage est désactivé par défaut sur Render. Le futur VPS devra fournir le DNS, le reverse proxy et les certificats HTTPS. L'autorisation d'émission TLS est contrôlée par `/api/v1/public/domains/allow`. Voir [le guide VPS](VPS-STOREFRONT-DOMAINS.md). La revérification périodique et le transfert administratif guidé restent à développer.

## Composition de l'accueil

`ShopHome` sépare le brouillon privé et l'instantané public en français/arabe, sans modifier les JSON commerciaux existants. Le propriétaire dispose d'une édition avec version attendue et verrou de boutique, d'un aperçu privé, d'une publication explicite et d'un retour au thème. Les accès publics conservent les contrôles de publication, d'abonnement et de domaine. Les sections restent du contenu typé, sans code marchand exécutable ; le catalogue et le checkout restent des composants métier protégés. Voir [le fonctionnement de l'accueil](shop-home.md).
