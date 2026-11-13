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

`ShopDomainClaim` conserve les demandes et preuves TXT ; `ShopDomainBinding` assure l'unicité globale des domaines vérifiés. La gestion appartient au propriétaire des boutiques indépendantes et historiques. Le Proxy Next associe le véritable Host à une seule boutique et refuse les routes privées et les autres boutiques. Les commandes restent validées côté serveur avec une origine HTTPS correspondant à cette boutique. Les sous-domaines automatiques utilisent le slug du Shop sous une racine réservée à l'exploitant ; un Workspace historique peut conserver un autre slug pour son catalogue. Les suivis historiques sont limités au Workspace du domaine.

Le routage est désactivé par défaut sur Render. Le futur VPS devra fournir le DNS, le reverse proxy et les certificats HTTPS. L'autorisation d'émission TLS est contrôlée par `/api/v1/public/domains/allow`. Le worker revérifie les preuves personnelles chaque jour ; le routage refuse les preuves de plus de 72 heures ou d'un autre propriétaire. Voir [le guide VPS](VPS-STOREFRONT-DOMAINS.md). Le transfert entre boutiques distinctes conserve une étape administrative ; la récupération après changement de propriétaire impose un nouveau code.

## Composition de l'accueil

`ShopHome` sépare le brouillon privé et l'instantané public en français/arabe, sans modifier les JSON commerciaux existants. Le propriétaire dispose d'une édition avec version attendue et verrou de boutique, d'un aperçu privé, d'une publication explicite et d'un retour au thème. Les accès publics conservent les contrôles de publication, d'abonnement et de domaine. Les sections restent du contenu typé, sans code marchand exécutable ; le catalogue et le checkout restent des composants métier protégés. Voir [le fonctionnement de l'accueil](shop-home.md).

## État de la transition au 13 novembre 2026

Le déploiement conserve un monolithe modulaire Next/Node et un worker séparé, reliés à PostgreSQL. Le pack VPS ajoute un proxy Caddy, des volumes persistants et une image de migration distincte. Le compte applicatif dispose de droits DML, les migrations de droits séparés. Les conteneurs réels de recette vérifient démarrage, arrêt, persistance et restauration dans une base séparée. Le VPS cible et ses sauvegardes hors site ne sont pas activés par ce pack. Voir [VPS-CONTAINERS.md](VPS-CONTAINERS.md).

`Workspace.data` et `ShopCommerce.data` restent les références des écritures. Les produits ont une copie relationnelle de recherche et de pagination (`ShopCatalogIndex`/`ShopCatalogProduct`). Les commandes et clients possèdent aussi leur copie typée (`ShopActivityIndex`/`ShopActivityOrder`/`ShopActivityCustomer`), leurs filtres et une vérification de parité opérateur. Les compteurs SQL détectent les écritures anciennes ; une copie périmée entraîne une lecture compatible et les écritures principales maintiennent les copies prêtes dans leurs transactions. Les articles, événements et extensions restent partiellement JSON pendant cette phase. Voir [catalog-read-model.md](catalog-read-model.md) et [activity-read-model.md](activity-read-model.md).

Les médias courants restent conservés en base, avec un miroir privé configurable sur disque, des pointeurs vérifiés et un repli PostgreSQL. Le nettoyage optionnel ne supprime que des copies reconnues sans référence après un délai, avec limites et reprise persistante. Une médiathèque ne devient pas entièrement publique quand sa vitrine est publiée : les URL globales exigent une référence dans un produit actif ou la marque d'une vitrine actuellement publique du même propriétaire. Les photos de sections suivent leurs endpoints de publication spécifiques. Voir [MEDIA-STORAGE-TRANSITION.md](MEDIA-STORAGE-TRANSITION.md).

Le worker assure présence, purge bornée, rappels d'échéance, communications configurées et revérification DNS. Les tâches et événements sortants sont durables, dédupliqués, chiffrés lorsque nécessaire et soumis à des reprises bornées. La réception SMTP, les paiements et notifications de prestataires réels ne sont pas démontrés par une simulation locale.

Les cinq priorités actuelles restent la référence du suivi dans [PROGRESS-15-PERCENT.md](PROGRESS-15-PERCENT.md). Cette architecture décrit aussi des fonctionnalités cibles plus larges, dont l'IA et des analyses avancées : elle ne les présente pas comme livrées par les lots de stabilisation et d'exploitation.
