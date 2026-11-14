# Thèmes de boutique pro et animés

Conception : [specs/2026-11-14-themes-pro-animes-design.md](superpowers/specs/2026-11-14-themes-pro-animes-design.md).

## Ce qui change pour les marchands

- **Six nouveaux thèmes**, disponibles pour les vitrines (`/vitrines/{slug}`) et les boutiques indépendantes (`/boutiques/{slug}`) : Médina, Sahara, Bento, Souk Flash, Aurora et Magazine. Chacun a une démonstration sur `/themes/{CODE}` et apparaît dans les galeries de choix ainsi que sur la landing.
- **Les 14 thèmes existants gardent leur style** et reçoivent la même couche d'animation : apparition au défilement, cartes qui se soulèvent au survol, retour visuel au clic, en-tête collant et flouté, rebond du compteur du panier.
- **Le bouton « Mettre en pause » est disponible sur tous les thèmes.** Les animations sont coupées automatiquement quand le visiteur a demandé moins de mouvement sur son appareil.

| Code vitrine / indépendant | Accueil | Cartes | Décor |
| --- | --- | --- | --- |
| `MEDINA` / `medina` | visuel en arche | tuiles à liseré doré | zellige qui se dessine |
| `SAHARA` / `sahara` | dunes | éditoriales sans bordure | dunes qui ondulent |
| `BENTO` / `bento` | mosaïque de cases | arrondies, 1re carte en grand | — |
| `SOUK` / `souk` | bandeau défilant + bande produits | « flash » à ombre franche | rayures animées |
| `AURORA` / `aurora` | classique | verre dépoli | halos de couleur |
| `MAGAZINE` / `magazine` | couverture plein cadre | grille asymétrique numérotée | grain photo |

## Fonctionnement

- `modules/shops/theme-layouts.ts` : une table fermée associe chaque thème à ses variantes (`hero`, `cards`, `motif`). Les pages posent ces valeurs dans des attributs `data-hero`, `data-cards` et `data-motif`, et marquent leurs éléments avec `data-part` (`header`, `hero`, `hero-visual`, `product-card`, `cta`…).
- `components/storefront-motion.module.css` et `components/storefront-reveal.tsx` constituent la couche commune. Seuls les éléments que le script marque `data-reveal="pending"` sont masqués : sans JavaScript, ou pour un produit ajouté après le chargement, tout reste visible.
- `components/storefront-themes/*.module.css` contient un fichier par nouveau thème, qui couvre les deux types de boutiques. `themeClass(code)` donne la classe racine correspondante.
- `components/theme-motif.tsx` affiche les décors en SVG ou CSS, masqués aux lecteurs d'écran (`aria-hidden`). `components/theme-hero-extras.tsx` affiche les tuiles Bento et la bande produits Souk : un bloc n'apparaît que si une vraie donnée de la boutique l'alimente.
- Les thèmes restent des préréglages : aucun CSS ni code n'est fourni par le marchand. Le panier, le checkout et les montants ne changent pas.

## Promotions honnêtes

Souk Flash n'affiche **ni compte à rebours ni urgence inventée**. Le badge « 2 pièces · 169,000 TND » provient uniquement des offres de quantité réelles du produit (`badgeQuantityOffer`, qui ignore la ligne du prix unitaire). Dans les autres thèmes, ce badge reste masqué.

## Vérifications effectuées

- `npm run typecheck`, `npm test` (426 tests) et `npm run build` réussis.
- Le test HTTP couvre les 20 démos, avec les attributs propres à Bento, Souk et Médina, ainsi que la landing.
- Captures en 1280×900 et 390×844 de chaque nouvelle démo, puis de vraies vitrines et boutiques créées dans une base PostgreSQL jetable. Pages contrôlées : `/vitrines` Souk, Bento, Aurora et Magazine, Médina en arabe sur mobile, Sahara en arabe sur bureau ; `/boutiques` Souk, Aurora et Magazine. Aucun débordement horizontal ni aucune erreur JavaScript n'a été relevé.
- En mode « moins d'animations », aucune animation n'est active et le zellige reste visible.

## Limites

- Les captures ont été faites avec Chromium uniquement. Safari et Firefox, ainsi que les vrais téléphones et les réseaux lents, restent à contrôler.
- Les vitrines de test utilisent le catalogue de démonstration, sans photos réelles. Le rendu avec les photos et bannières des marchands reste à vérifier en recette.
