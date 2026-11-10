# Tunicom — landing page et thèmes animés

Le nom visible de la plateforme devient **Tunicom** : titres, écrans de connexion, administration, libellés marchands, messages de sécurité et identité d'expéditeur TOTP. Les noms de cookies, identifiants de stockage, noms de variables d'environnement existants et adresses de dépôt restent compatibles.

## Landing page

Les visiteurs anonymes découvrent la landing à `/`. Les utilisateurs déjà connectés gardent la redirection vers leur portail marchand ou administrateur. `/decouvrir` reste accessible pour présenter la plateforme, même lorsqu'une session existe.

Direction visuelle : fond crème, typographie contrastée, vert électrique, touches lavande et pêche, illustrations vectorielles originales de produits. La page contient une boutique animée de démonstration, les fonctions du produit, un sélecteur interactif des quatre nouveaux thèmes, trois étapes de démarrage, une FAQ et des liens vers l'inscription et la connexion réelles. Les exemples de produits, prix et notifications sont identifiés comme fictifs. Aucun chiffre de clientèle, témoignage ni résultat commercial n'est inventé. La FAQ indique l'état réel des connexions transporteurs et paiements.

Les animations utilisent CSS, principalement transform et opacity : flottement des visuels, rotation décorative, bandeau défilant et apparition au défilement. Un bouton met les animations en pause ; les contenus révélés restent alors pleinement visibles. `prefers-reduced-motion` désactive animations et transitions. La navigation mobile possède son menu et les contrôles disposent de libellés accessibles. Aucun paquet d'animation ni ressource d'image distante n'est ajouté.

## Nouveaux thèmes de boutique

| Thème | Direction | Mise en page |
| --- | --- | --- |
| Pulse | Noir et vert néon, streetwear et drops | Titres massifs, cadres francs, actions graphiques |
| Sorbet | Pêche et cerise, beauté et créateurs | Typographie éditoriale, visuel en arche, cartes arrondies |
| Chrome | Bleu glacé, tech et audio | Surfaces métalliques légères, volumes nets, cartes épurées |
| Groove | Lavande et violet, lifestyle créatif | Titres italiques, découpes asymétriques et ombres décalées |

Les dix thèmes existants sont conservés, soit quatorze au total. La galerie marchande propose les nouveaux thèmes dans leurs secteurs et indique ceux qui sont animés. Les choix sont validés par la même liste côté API et métier. Le changement de thème conserve catalogue, stocks, commandes et montants.

Les quatre nouveaux thèmes disposent d'un bouton de pause sur la vitrine publique et l'aperçu privé. La préférence de mouvement réduit est appliquée par CSS. Les animations concernent la présentation ; elles ne retardent pas les actions d'achat ou les saisies. Le contraste des boutons d'action des quatorze palettes est vérifié par les tests existants étendus.

`/themes/{CODE}` présente chacun des quatorze thèmes avec des produits fictifs et les mêmes styles de vitrine que le commerce réel. Ces démonstrations n'acceptent pas de commande. Elles et la landing de découverte fonctionnent sans connexion PostgreSQL ; aucun compte ou espace commercial n'est créé lors de leur consultation.

## Vérifications et livraison

La recette dans le navigateur a contrôlé la landing sur bureau et dans un viewport mobile de 390 × 844, l'absence de débordement horizontal, le menu mobile, le changement d'aperçu vers Sorbet et la pause effective des animations. Le thème Pulse a été contrôlé en format mobile, Sorbet en format bureau. Les captures sont fournies dans les livrables.

La nouvelle suite HTTP vérifie la landing et les quatorze démonstrations avec une base volontairement inaccessible, leurs liens, leur identification comme démonstration et le refus d'un thème inconnu. Les tests des portails gardent les contrôles d'accès privés et adaptent l'accueil anonyme à sa nouvelle fonction publique.

Les changements sont préparés en proposition de revue. Aucun déploiement, modification de base hébergée, choix de prestataire ou envoi réel n'est effectué. Les performances sur appareils physiques et réseaux mobiles réels restent à mesurer ; aucun gain chiffré n'est annoncé.
