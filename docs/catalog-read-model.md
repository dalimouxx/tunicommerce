# Catalogue paginé et transition relationnelle des produits

Le lien **Consulter mon catalogue** du tableau de boutique ouvre une recherche privée par nom, référence, catégorie ou variante, avec filtres de publication et de stock, pagination de quarante produits et actualisation explicite. Le parcours couvre les commerces indépendants et les boutiques historiques liées à un Workspace. La recherche accepte le français avec ou sans accents, l'arabe et les caractères `%`, `_` et `\` comme texte littéral.

## Transition additive

Les écritures commerciales continuent d'utiliser Workspace.data et ShopCommerce.data pendant cette phase. Aucune commande, aucun produit et aucun historique existant n'est remplacé par la migration. ShopCatalogIndex identifie la source et sa version de catalogue ; ShopCatalogProduct contient une ligne par produit et boutique avec références, champs commerciaux, montants et stocks entiers, ordre d'origine et index de recherche. Les champs optionnels et extensions existantes sont conservés dans extra, sans arrondi des montants. Les entiers sont stockés en BIGINT puis convertis uniquement s'ils restent représentables exactement en JavaScript.

Une colonne catalogVersion est ajoutée aux deux sources. Des triggers PostgreSQL comparent uniquement le tableau products : une variation de stock, prix, ordre ou contenu de produit avance cette version, même quand une ancienne voie d'écriture ignore le modèle relationnel. Une modification de facture, note ou thème seule ne l'avance pas. Les applications ne peuvent pas la forcer par une mise à jour ordinaire du champ.

Le catalogue utilise les lignes relationnelles uniquement quand le type, l'identifiant et la version de la source correspondent. Sinon il lit les produits actuels dans la source existante, avec les mêmes filtres et la même pagination. La transaction de lecture REPEATABLE READ évite de mélanger un compteur d'une version avec des lignes d'une autre. Un GET n'initialise aucun modèle ni espace commercial. Les nouvelles tables restent vides au déploiement jusqu'à une actualisation explicite ou une préparation opérateur.

## Préparation et maintien

**Actualiser le catalogue** prépare la recherche pour la boutique active, sous verrou de propriétaire puis de source et de boutique. Les JSON et versions commerciales sont conservés. Deux préparations simultanées sont sérialisées ; une copie déjà actuelle ne se reconstruit pas inutilement. La création des lignes est découpée en lots de mille, dans une seule transaction. Un catalogue de plus de 50 000 produits ou comportant des valeurs historiques invalides exige une préparation par le support ; il n'est pas arrondi, tronqué ou réécrit silencieusement.

Les quatre voies principales de mutation commerciale (marchand et checkout public, historiques et indépendants) maintiennent une copie déjà prête dans la même transaction que les stocks. Seules les lignes modifiées ou retirées sont remplacées. Les reprises d'une commande ou d'un ajustement de stock n'appliquent pas deux fois la modification. Si un ancien chemin modifie les produits sans synchroniser les lignes, la version PostgreSQL rend la copie périmée et la lecture compatible prend immédiatement le relais. Une actualisation la reconstruit ensuite. La compatibilité garantit la justesse, pas la même performance qu'une copie préparée.

L'accès à l'API `/api/v1/shops/<shopId>/catalog` et à la page exige le véritable propriétaire actif de l'organisation et de la source historique éventuelle. Les collaborateurs, les faux OWNER d'une organisation tierce et une session d'administration globale ne reçoivent pas ces informations. L'API de lecture borne q à 100 caractères, pageSize à 100 et refuse les paramètres inconnus. L'actualisation exige une requête de même origine.

## Contrôle opérateur

Avec DATABASE_URL configurée dans l'environnement sécurisé :

```sh
npm run catalog:verify -- --shop-id=IDENTIFIANT
```

Cette commande est en lecture seule par défaut. Elle compare les produits de la source et les lignes relationnelles, y compris les extensions, les montants, le stock et l'ordre. Elle affiche uniquement des compteurs, pas les contenus des produits. Code de sortie 0 si la copie est actuelle et identique, 1 si elle est absente/périmée/différente, 2 si le contrôle est indisponible.

```sh
npm run catalog:verify -- --shop-id=IDENTIFIANT --apply
```

Le drapeau explicite --apply reconstruit uniquement la copie relationnelle, même si son compteur de version paraît actuel, puis revérifie la parité. Il ne modifie pas les JSON commerciaux. Tester les commandes sur une base de recette avant le futur VPS et suivre la politique de sauvegarde. Le déploiement n'exécute pas ce backfill sur toutes les boutiques.

Ce lot constitue une première étape de normalisation des produits et un modèle de lecture réellement utilisé par le nouveau catalogue. Les commandes, clients, mouvements et écritures de produits restent à migrer progressivement vers une source relationnelle de référence. Le stockage des fichiers et les autres parcours de gestion ne basculent pas par cette livraison.
