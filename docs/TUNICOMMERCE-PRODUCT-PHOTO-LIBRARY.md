# TuniCommerce — médiathèque des photos produits (version pilote)

## Parcours marchand

- Ouvrir `/marchand` > `Photos produits` ou `/mediatheque`.
- Importer JPG, PNG ou WebP depuis l'ordinateur ou le téléphone.
- Le navigateur décode l'image, la réduit à environ 1600 px et la compresse en WebP (JPEG si le navigateur ne gère pas WebP), jusqu'à **400 Ko**.
- Dans le tableau de bord marchand, ouvrir **Produits** > **Ajouter/modifier un produit**, puis sélectionner une image déjà importée dans la galerie.
- Enregistrer le produit. Le champ `imageUrl` existant affiche l'image dans le catalogue et la boutique publique sans modifier les stocks ni les flux COD.
- Les anciennes URL HTTPS de produits restent acceptées.
- Pour supprimer une photo, d'abord la retirer de tous les produits qui l'utilisent.

## Stockage et sécurité

- Nouvelle table **ProductMedia** indépendante des commandes, produits et visuels de marque, liée au Workspace propriétaire.
- Limite provisoire **30 photos par boutique**, **400 Ko maximum par photo** (soit 12 Mo maximum par boutique).
- Contrôle du format réel et des dimensions sur le serveur (PNG, JPEG, WebP, 2400 px et 4 MP max).
- Flux HTTP borné avant allocation complète, type d'image validé et URL UUID.
- Authentification propriétaire, protection de même origine, tentatives d'upload limitées.
- Les images de boutiques non publiées ne sont accessibles qu'au propriétaire ; après publication active, les images deviennent consultables publiquement.
- Les marchands ne peuvent pas associer les images privées d'une autre boutique aux produits.
- La suppression d'une image utilisée par un produit est interdite.
- Quota vérifié sous verrouillage transactionnel ; suppression coordonnée avec la version optimiste des données de la boutique.

## Limites et prochaine migration

Le stockage actuel est volontairement limité dans **PostgreSQL BYTEA**. Il s'agit d'un pilote pour valider l'expérience produit sur Render, **pas d'un système de fichiers e-commerce à grande échelle**. Neon Object Storage est disponible sur le projet, mais son accès sécurisé depuis le serveur Render doit encore être configuré pour éviter d'exposer les clés. Ne jamais placer une clé S3 dans le navigateur.

Étape suivante : basculer les blobs vers Neon Object Storage ou un bucket S3-compatible avec accès serveur, URLs CDN ou proxy de lecture, pagination, quotas par abonnement, miniature multiple, dédoublonnage, galerie multi-images par produit et migration des anciens médias. Conserver les identifiants UUID et liens publics pour ne pas casser les images existantes.

## Validation

La CI `.github/workflows/product-media-regression.yml` lance l'analyse de type, les tests de validation, la migration répétable, la compilation et les tests HTTP en PostgreSQL isolé. Les scénarios couvrent deux marchands, la confidentialité des brouillons, le blocage des imports malveillants, l'association aux produits, la vitrine publique, une commande COD et la suppression sûre.

Aucune API de commande ou de livraison n'est modifiée par le moteur d'images. La migration `202611010004_product_media` est additive.
