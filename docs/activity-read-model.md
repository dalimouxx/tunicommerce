# Recherche privée des commandes et clients

Depuis le tableau d'une boutique, **Rechercher mes commandes et clients** ouvre `/mes-boutiques/<shopId>/activite`. La page propose une recherche par référence, nom, téléphone, ville, transporteur ou suivi pour les commandes, et par nom, téléphone ou ville pour les clients. Les accents français sont normalisés ; l'arabe et les caractères `%`, `_` et `\` restent du texte littéral. Les résultats sont paginés par quarante, avec un filtre de statut pour les commandes. Les formulaires et erreurs conservent la saisie et les derniers résultats.

La page est une consultation. Les opérations commerciales restent dans la gestion existante. Elle affiche uniquement les coordonnées nécessaires au suivi : l'API ne retourne ni adresse, ni notes, ni articles, ni historique d'événements ou jeton public de suivi. Seul le véritable propriétaire actif de l'organisation et, le cas échéant, du Workspace historique peut lire ou actualiser. Un collaborateur portant le rôle OWNER dans une organisation qu'il ne possède pas est refusé, ainsi qu'une session du portail administrateur.

## Migration compatible

La migration ajoute `activityVersion` aux sources Workspace et ShopCommerce. Un déclencheur PostgreSQL l'avance seulement si les tableaux `orders` ou `customers` changent, y compris lors d'une écriture provenant d'une ancienne instance. Une modification du thème ou des seuls produits ne l'avance pas ; une mise à jour directe du compteur ne peut pas forcer sa valeur.

`ShopActivityIndex` mémorise l'origine et sa version. Les commandes et clients possèdent leurs propres lignes typées, avec montants BIGINT sans arrondi et index par boutique, statut et ordre d'origine. Les extensions historiques sont conservées dans `extra`, ainsi que les articles et événements des commandes pendant cette transition. Les compteurs clients sont recalculés à partir des commandes, en comptant les ventes livrées brutes. Une commande conserve les coordonnées de son instantané client lorsqu'il existe.

Une lecture n'initialise rien. Si la copie manque ou ne correspond plus à l'origine et à sa version, les données actuelles sont lues depuis la source historique. Une transaction REPEATABLE READ maintient une pagination et un compteur cohérents. Quand la copie est actuelle, la recherche et la pagination utilisent SQL et sélectionnent uniquement les champs du résumé ; le JSON commercial complet n'est pas chargé. La recherche par sous-chaîne n'a pas encore d'index trigramme : mesurer les volumes réels avant cette optimisation.

**Actualiser la recherche** prépare la copie sous les mêmes verrous de propriétaire et de source que les écritures commerciales. Les tables sont reconstruites dans une transaction par lots de mille, sans modifier les JSON ni les versions commerciales. Les valeurs historiques invalides, les identifiants dupliqués, plus de 50 000 commandes ou clients et les montants agrégés hors limites exactes JavaScript exigent une préparation par le support ; ils ne sont ni arrondis ni tronqués. Le chemin compatible partage cette validation et signale ces données à préparer.

Les écritures marchand et les deux checkouts publics maintiennent une copie déjà prête dans la même transaction. Seules les lignes modifiées ou supprimées sont remplacées, y compris les résumés affectés par un changement de client. Les reprises idempotentes n'ajoutent pas deux fois la commande. Une ancienne écriture rend la copie périmée grâce au compteur SQL et la lecture compatible prend le relais. Si une copie prête ne peut plus représenter les données, elle est invalidée sans imposer une réécriture silencieuse du commerce.

## Contrôle opérateur

```sh
npm run activity:verify -- --shop-id=IDENTIFIANT
npm run activity:verify -- --shop-id=IDENTIFIANT --apply
```

Sans `--apply`, la commande ne modifie rien et compare les lignes, leur ordre, les extensions et les champs dérivés avec la source. Elle retourne uniquement des compteurs : 0 si actuelle et identique, 1 si absente/périmée/différente, 2 si indisponible. `--apply` reconstruit explicitement la copie puis la vérifie, sans changer les données commerciales. Aucune préparation globale de toutes les boutiques n'est lancée au déploiement. Tester sur une base de recette et conserver les sauvegardes.

Les JSON restent la référence des écritures. Cette livraison étend la transition relationnelle aux commandes et clients ; elle ne termine pas la normalisation des articles, mouvements, retours et écritures de référence. La suppression des anciennes données n'est pas autorisée par ce backfill.
