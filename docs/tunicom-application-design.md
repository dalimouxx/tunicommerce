# Tunicom — identité de l'application et galeries de thèmes

La direction visuelle de la landing est étendue à l'application : crème, noir et vert électrique, accents lavande et pêche, typographie Manrope, cartes lisibles et actions contrastées.

## Espaces concernés

- Connexions marchand et administrateur, inscription et choix du portail.
- Tableau de bord commercial, cartes de chiffres, navigation, tableaux et formulaires.
- Administration SaaS : navigation active avec `aria-current`, cartes statistiques, listes, formulaires, abonnements et paiements manuels.
- Liste et gestion des boutiques indépendantes, onglets de travail, pages et éditeur.
- Personnalisation historique, équipes, abonnement, démarrage et médiathèque.

`AppSurface` marque explicitement les routes privées avec `data-tunicom-ui`. La landing, les démonstrations et les vitrines publiques conservent leurs styles propres. Les styles communs de l'application sont dans `app/tunicom-ui.css` ; les styles de chaque espace restent limités par leurs modules CSS. La navigation administrative utilise `AppNavLink` pour identifier l'entrée courante.

Les animations de gestion restent discrètes : transitions d'action et décoration de connexion. La préférence de mouvement réduit désactive les animations privées et les effets des thèmes. Les tableaux gardent leur défilement local et la navigation administrative s'adapte en rangées défilantes sur petit écran.

## Deux galeries, anciens thèmes conservés

| Galerie | Anciens styles conservés | Nouveaux styles | Total |
| --- | --- | --- | --- |
| Boutiques historiques, `/personnalisation` | Essentiel, Éditorial, Prestige, Pop | Pulse, Sorbet, Chrome, Groove | 8 |
| Boutiques indépendantes, onglet Thèmes | Oasis, Sable, Minuit, Nova, Atelier, Prestige, Pop, Éclat, Urban, Zen | Pulse, Sorbet, Chrome, Groove | 14 |

Les quatre nouveaux thèmes existent maintenant dans le studio historique, sa validation serveur, son aperçu et le rendu des boutiques `/boutiques/{slug}`. Sélectionner un nouveau thème prépare sa couleur recommandée ; l'utilisateur peut choisir parmi dix couleurs autorisées avant de sauvegarder. Les anciens choix restent valides et aucune boutique existante n'est reconfigurée automatiquement.

Le texte des boutons est sombre pour l'accent néon et blanc pour les autres couleurs approuvées. Les dix couples sont vérifiés pour un contraste de bouton d'au moins 4,5:1. Les animations des nouveaux thèmes peuvent être suspendues dans l'aperçu et sur la vitrine publique ; le bouton retrouve son conteneur `data-motion-root` sans modifier le panier ou les formulaires.

La sauvegarde historique utilise le mécanisme existant de version et les contrôles de propriété. Elle ne modifie pas les produits, commandes, clients ou mouvements de stock. Aucune migration de base, dépendance ou connexion externe n'est ajoutée.

## Validation

- 333 tests unitaires réussis, avec validation des huit thèmes historiques et du contraste des dix accents.
- 142 tests HTTP/PostgreSQL réussis dans les vingt suites d'intégration. Les quatre thèmes historiques sont sauvegardés, relus et rendus publiquement ; produits, commandes, clients et mouvements restent identiques. Le retour à un ancien thème est également vérifié.
- Compilation de production réussie, puis reprise après les corrections de recette visuelle.
- Recette navigateur sur une base locale distincte, avec comptes et commandes fictifs : connexion, tableau de bord marchand, administration, galerie de huit thèmes, sélection et sauvegarde de Pulse, lecture de la boutique publique et administration au format 390 × 844.

Les captures utilisent exclusivement les données fictives de recette. Le serveur et les comptes temporaires ont été nettoyés après vérification. La recette n'est pas une mesure de performances sur téléphone physique.
