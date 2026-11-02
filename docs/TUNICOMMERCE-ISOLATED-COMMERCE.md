# Étape 02 — socle commercial réellement isolé par boutique

PR dépendante de #16, #15. La table additionnelle `ShopCommerce` possède une clé primaire `shopId` et ne modifie jamais les données JSON historiques du modèle `Workspace`.

- `GET /api/v1/shops/{shopId}/commerce` exige une session et une appartenance OWNER active à une Shop **sans** lien vers le Workspace historique. Renvoie l'état neuf non-demo en mémoire si la boutique n'est pas encore initialisée. Ne modifie aucune donnée sur un GET.
- `POST /api/v1/shops/{shopId}/commerce` avec `{"action":"initialize"}` crée une fois l'espace commercial de cette boutique, sous contrainte unique ; les répétitions sont sans effet et ne réinitialisent jamais l'espace.
- Aucune commande, client, facture, média, abonnement ou stock de l'ancien Workspace n'est copié.
- Les managers et collaborateurs n'ont pas accès à cette API, ni à des données commerciales par défaut.
- Le nouveau stockage commercial est indépendant et prêt pour l'ajout ultérieur des mutations transactionnelles, des limites SaaS et du checkout public.

**Limites :** aucune création ou modification de commande/produit n'est encore autorisée sur cette API ; l'initialisation n'active pas la publication d'une vitrine ou l'encaissement COD. Le moteur commercial et ses quotas ne doivent pas être activés sur cette nouvelle table sans développement et tests supplémentaires.

Validation nécessaire avant fusion : tests PostgreSQL dédiés de migration, vérification d'isolation tenant, authentification/CSRF, build et sauvegarde de Neon. Ne pas fusionner ou déployer en production avant cette vérification.
