# Chantier TuniCommerce — blocs 1 à 7

## Périmètre demandé

1. Comptes : récupération de mot de passe, vérification d'e-mail, double authentification.
2. Données et médias : normalisation progressive et stockage objet.
3. Livraison : connexions transporteur, expéditions et événements vérifiés.
4. Communications : envois transactionnels, modèles et suivi des tentatives.
5. Paiements : préparation du paiement en ligne et des confirmations authentifiées.
6. Construction de boutique : sections/pages et domaines personnalisés.
7. Automatisations : file durable, workers et événements entrants/sortants.

Le propriétaire n'a choisi aucun prestataire de livraison ou de paiement. Les intégrations réelles ne pourront pas être déclarées opérationnelles avant choix, configuration et essais des prestataires. Les capacités internes et leurs écrans peuvent être développés en amont.

## Ordre technique

Le socle de tâches du bloc 7 précède les envois du bloc 1 et du bloc 4. Chaque bloc doit conserver la compatibilité des commerces existants, l'isolation par boutique, les montants exacts et les protections contre les doubles envois. Les migrations sont additives et testées sur une base jetable.

Les changements sont préparés en branche et en proposition de revue. Aucun choix de prestataire payant, achat, envoi réel à des destinataires, débit financier ou modification des bases hébergées n'est autorisé implicitement par ce chantier de développement.

## Critères de livraison

- Un parcours annoncé comme développé doit comporter une implémentation et des vérifications appropriées.
- Un service absent est indiqué non configuré, sans simulation présentée comme réelle.
- Un identifiant de fournisseur ou une variable d'environnement ne constitue pas une preuve de connexion.
- Les traitements asynchrones sont traçables, limités et reprenables.
- Les secrets et les liens de récupération ne figurent pas en clair dans les journaux ou les réponses d'administration.
- Les opérations sensibles demandent une session et une vérification serveur adaptées.

## État après le premier lot

| Bloc | Réalisé dans ce lot | Reste à réaliser |
| --- | --- | --- |
| 1 — Comptes | Récupération, vérification d'adresse, TOTP, codes de secours, révocation des sessions, parcours marchands et administrateurs | Recette visuelle et recette SMTP réelle après configuration ; politique de récupération si tous les seconds facteurs sont perdus |
| 2 — Données et médias | Aucun changement de stockage commercial dans ce lot | Normalisation progressive des produits/commandes/clients et stockage objet |
| 3 — Livraison | Aucun transporteur choisi ni connecté | Choix du contrat, adaptateur documenté, expéditions et événements authentifiés |
| 4 — Communications | Transport SMTP configurable pour les e-mails de sécurité, chiffrement et suivi des tentatives | Activation SMTP, communications de commande, modèles marchands, SMS et WhatsApp Business |
| 5 — Paiements | Les déclarations et vérifications manuelles déjà développées sont conservées | Choix et raccordement d'un paiement en ligne, récurrence SaaS et rapprochement bancaire |
| 6 — Pages et domaines | Les thèmes existants sont conservés | Éditeur de sections/pages, prévisualisation, publication et vérification des domaines |
| 7 — Automatisations | File PostgreSQL, baux concurrents, reprises bornées, arrêt propre et écran de suivi administratif | Hébergement du worker, supervision, politique de purge et événements/webhooks métier |

Le bloc 1 est implémenté et testé localement ; les blocs 4 et 7 disposent d'un premier socle. Le chantier 1 à 7 n'est pas terminé. L'absence de prestataires empêche les connexions réelles des blocs 3 et 5, sans empêcher le travail interne des autres blocs.

Validation : 330 tests unitaires réussis ; les 18 suites PostgreSQL/HTTP ont réussi (130 tests), puis la suite comptes a été enrichie de deux contrôles supplémentaires et ses 12 tests ont réussi. TypeScript, compilation de production et comparaison du schéma Prisma réussis ; audit npm à zéro vulnérabilité déclarée. Aucun test de délivrabilité réelle ni déploiement n'a été effectué. Les détails d'exploitation sont dans `docs/account-security-worker.md`.

## Deuxième lot — pages de boutique

Le bloc 6 dispose maintenant d'un éditeur de pages complémentaires pour le propriétaire d'une boutique indépendante initialisée. Il comprend cinq types de sections réordonnables, le français/arabe, l'aperçu privé, les instantanés brouillon/publié, le retrait de publication et les liens dans la navigation publique. Une version attendue protège les écritures concurrentes ; la publication de la boutique et la validité de l'abonnement sont recontrôlées sur chaque accès public.

Le plafond est de dix pages par boutique et douze sections par page. Les domaines personnalisés, les images de section, l'historique de restauration et la composition de la page d'accueil restent à développer. La migration ajoute `ShopPage` sans changer les données commerciales existantes. Le détail du parcours et des limites figure dans `docs/shop-pages.md`.

## Lots suivants — domaines et accueil personnalisable

Le rattachement des domaines par preuve TXT, les sous-domaines automatiques et le routage isolé sont implémentés. Leur activation DNS/HTTPS réelle reste à effectuer sur le futur VPS ; le routage demeure désactivé par défaut sur Render. Voir `docs/VPS-STOREFRONT-DOMAINS.md`.

L'accueil dispose désormais de textes et sections en français/arabe, d'un ordre et d'une position configurables, d'un brouillon privé, d'un aperçu, d'un instantané publié et d'un retour à l'accueil du thème. La restauration depuis la version actuellement publiée ne constitue pas un historique. Le catalogue et le panier restent disponibles. La migration `ShopHome` est additive ; les données commerciales ne sont pas réécrites. Voir `docs/shop-home.md`.

Les sections image de l’accueil utilisent désormais la médiathèque du propriétaire, les légendes et les formats de cadrage. L’accueil conserve les 20 dernières étapes dans un historique privé avec aperçu FR/AR et restauration dans le brouillon. Les pages complémentaires des boutiques indépendantes disposent aussi de 20 étapes par page, avec aperçu et restauration du contenu et de sa langue sans changer son adresse. Le bloc 6 reste à compléter pour le stockage objet, les images des pages complémentaires, la composition plus libre et la recette réelle des domaines sur VPS. Les autres blocs conservent leurs prérequis fournisseur et leurs limites indiquées plus haut.

