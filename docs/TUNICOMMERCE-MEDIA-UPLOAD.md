# TuniCommerce — import d'images de marque (étape 1)

## Parcours

Le propriétaire d'une boutique ouvre `/personnalisation`, choisit un fichier PNG, JPEG ou WebP dans « Importer un logo » ou « Importer une bannière ». Le navigateur envoie directement l'image par `PUT /api/v1/media/logo` ou `PUT /api/v1/media/banner`, puis affiche son aperçu sans lien HTTPS à saisir.

Ces images sont sauvegardées immédiatement dans le compte de ce marchand. Le bouton « Enregistrer le design » continue de sauvegarder uniquement les couleurs, le thème, les textes et les liens choisis.

## Stockage temporaire et sécurité

- Nouveau modèle **ShopMedia** indépendant avec 2 emplacements maximum par boutique (logo et bannière).
- Taille maximale : **700 Ko pour le logo**, **2 Mo pour la bannière** ; 6000 px maximum par côté et 16 mégapixels en tout.
- Vérification des signatures et dimensions PNG/JPEG/WebP côté serveur ; SVG, scripts et types MIME inattendus rejetés.
- Envoi en flux limité : aucune image démesurée ne peut être intégralement chargée en mémoire par le serveur.
- Même origine, session marchande, limitation d'envoi (30 tentatives sur 10 minutes).
- URL interne stable basée sur un identifiant UUID, indépendante du slug de la boutique.
- Avant publication, une image ne peut être vue que par son propriétaire ; après publication, elle devient publiquement consultable.
- La modification de l'apparence ne peut pas réutiliser un identifiant d'image privée appartenant à une autre boutique.
- Anciennes URL HTTPS toujours acceptées. Les autres données dans Workspace (produits, clients, commandes, mouvements, stock) restent inchangées.
- Migration additive `202611010003_shop_media` ; aucune modification destructrice des modèles existants.

## Limites connues

Le stockage actuel utilise **PostgreSQL BYTEA** uniquement pour les deux petits visuels d'identité. Il ne convient **pas** aux catalogues volumineux de photos produit, aux vidéos, ni à un déploiement SaaS à grande échelle : l'étape suivante est de migrer ce stockage vers **Neon Object Storage** ou un service S3 compatible avec clé serveur stockée dans Render, CDN et traitement d'images.

Les fichiers de marque ne sont pas redimensionnés par le serveur : envoyer des images optimisées est recommandé. L'importation de photos produit, le recadrage, la compression automatique et la gestion d'une bibliothèque média sont à développer séparément.

## Vérification

```bash
npm run db:generate
npm run typecheck
npm run db:migrate
npm run build
node --import tsx --test tests/media-validation.test.ts
# Les tests HTTP complets ne doivent tourner que sur une base *_test indépendante.
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tunicommerce_media_test node --import tsx --test tests/media-api.test.ts
```

La CI `.github/workflows/media-upload-regression.yml` crée sa propre base de test PostgreSQL isolée et valide : permissions, CSRF, refus des fichiers invalides, confidentialité des brouillons, rendu boutique publiée et continuité du checkout COD.
