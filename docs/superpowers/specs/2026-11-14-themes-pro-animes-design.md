# Thèmes de boutique pro et animés — conception

Date : 2026-11-14. Statut : proposé, en attente d'approbation.

## Intention

Le porteur du projet aime le design de la plateforme (landing, espace marchand, admin) et ne veut pas le changer. Il veut des **vitrines de boutique plus professionnelles, plus jeunes et plus animées** :

1. améliorer les thèmes existants **sans changer leur identité** (couleurs, polices, style) ;
2. ajouter **6 nouveaux thèmes** à forte personnalité, chacun avec sa propre mise en page.

Aujourd'hui, tous les thèmes partagent la même mise en page (bandeau, en-tête, titre à gauche/visuel à droite, grille) et ne diffèrent que par la palette et quelques surcharges CSS. C'est la cause de l'impression de « boutique repeinte » et de faible animation.

## Objectifs

- Couche d'animation commune appliquée aux 14 thèmes vitrines et aux 8 thèmes des boutiques indépendantes.
- 6 nouveaux thèmes disponibles dans **les deux catalogues** : Médina, Sahara, Bento, Souk Flash, Aurora, Magazine.
- Chaque nouveau thème a une signature de mise en page propre (accueil, cartes produits, navigation, animation signature).
- Page de démonstration `/themes/{CODE}` pour chaque nouveau thème, et présence dans les galeries de choix (marchand et landing).

## Non-objectifs

- Pas de refonte de la landing, de l'espace marchand ni de l'admin.
- Pas de modification du panier, du checkout COD, du calcul des montants, du stock ni des API de commande.
- Pas de CSS ou de code fourni par le marchand : les thèmes restent des préréglages fermés (règle existante).
- Pas de nouvelle donnée métier (ex. date de fin de promo) dans ce lot.

## Anti-objectifs (échec même si « ça marche »)

- Une animation qui retarde ou gêne un achat (bouton qui bouge sous le doigt, contenu invisible tant que le JS n'a pas tourné, saut de mise en page).
- Une vitrine sensiblement plus lente sur mobile (bibliothèque d'animation lourde, images distantes).
- Une **urgence trompeuse** : pas de compte à rebours ou de stock « plus que 2 ! » inventé. Souk Flash utilise des messages vrais (paiement à la livraison, zones de livraison, réductions réelles) — voir plus bas.
- Une régression d'accessibilité : contraste des boutons < 4,5:1, animations non coupées avec `prefers-reduced-motion`, bouton pause cassé.
- Un thème cassé en arabe (RTL).

## Contraintes du code existant

- **Deux systèmes de thèmes** :
  - vitrines `/vitrines/[slug]` et démos `/themes/[theme]` : codes majuscules `storefrontThemeCodes` dans `modules/shops/storefront-themes.ts`, palettes complètes, styles dans `app/vitrines/[slug]/storefront-premium.module.css` via `data-theme="CODE"` ;
  - boutiques indépendantes `/boutiques/[slug]` : codes minuscules `themes` dans `modules/appearance/validation.ts`, détails dans `modules/appearance/theme-catalog.ts`, enveloppe `components/storefront-theme.tsx` + `components/storefront-theme.module.css`, couleur d'accent choisie dans la liste fermée `accents`.
- Les listes sont validées par Zod côté API et métier ; les tests `tests/isolated-storefront-themes.test.ts`, `tests/appearance-validation.test.ts`, `tests/landing-theme-http.test.ts` vérifient listes, refus de CSS arbitraire et contraste WCAG AA des boutons.
- `animatedStorefrontTheme()` et `appearanceThemeDetails[].animated` pilotent l'affichage du bouton pause (`StorefrontMotionToggle`, attribut `data-motion=paused`).
- Next.js 16.4 (lire `node_modules/next/dist/docs/` avant d'écrire du code, cf. AGENTS.md). Pas de dépendance d'animation ajoutée ; pas d'image distante.
- Les secteurs de la galerie (`sectorPresets`) servent de filtre éditorial.

## Approches considérées

- **A. Palette seule** sur la mise en page actuelle : rapide, mais résultat « repeint ». Écartée.
- **B. Thèmes à briques de mise en page** (retenue par le porteur) : chaque thème déclare une combinaison de variantes (accueil, cartes, navigation, motif/animation) appliquées par attributs `data-*` et CSS modules ; panier/checkout/catalogue restent les composants protégés existants.
- **C. Arbre React séparé par thème** : liberté totale mais duplication du checkout et risque élevé. Écartée.

## Conception retenue

### 1. Couche d'animation commune (tous les thèmes)

CSS uniquement (transform/opacity), plus un petit composant client pour l'apparition au défilement :

- apparition au défilement des sections et cartes (IntersectionObserver ; **le contenu est visible par défaut** et n'est masqué qu'une fois le JS chargé, pour ne jamais cacher un contenu si le script échoue) ;
- entrée en cascade des cartes produits (délai par index, plafonné) ;
- survol des cartes : léger soulèvement + zoom de la photo ; bouton : retour d'appui (`:active`) ;
- compteur du panier : petit rebond à l'ajout ;
- en-tête collant qui devient compact et flou au défilement.

Règles : `prefers-reduced-motion: reduce` et `data-motion=paused` désactivent tout et laissent le contenu visible ; aucune animation ne déplace un bouton d'achat pendant l'interaction. Le bouton pause devient disponible pour **tous** les thèmes (puisque tous sont désormais animés).

### 2. Six nouveaux thèmes

| Code vitrine / code indépendant | Nom | Secteurs | Signature |
| --- | --- | --- | --- |
| `MEDINA` / `medina` | Médina | Maison/artisanat, cadeaux | Motif zellige en SVG inline qui se dessine (stroke-dashoffset), arches sur les visuels, filets dorés, accent bleu de Nabeul ou terracotta |
| `SAHARA` / `sahara` | Sahara | Mode, parfums, bien-être, luxe | Dunes en dégradé animé lentement en fond du hero, typographie fine à grands espacements, palette sable/ocre |
| `BENTO` / `bento` | Bento | Tech | Accueil en mosaïque de cases (titre, promo, nouveauté, produit vedette, catégories), cases qui s'animent au survol, palette claire nette |
| `SOUK` / `souk` | Souk Flash | Promos, dropshipping, mode | Bandeau défilant de promesses réelles, badges « Paiement à la livraison » / « Livraison en Tunisie », cartes à fort contraste avec réduction réelle mise en avant, carrousel horizontal |
| `AURORA` / `aurora` | Aurora | Beauté, cosmétiques | Halos de couleur qui dérivent en fond, cartes en verre dépoli (backdrop-filter avec repli opaque), arrondis généreux |
| `MAGAZINE` / `magazine` | Magazine | Mode, créateurs | Visuel plein écran, titres géants serif, grille produits asymétrique (une grande carte, puis petites), numérotation éditoriale |

Souk Flash : **pas de compte à rebours** (aucune date de fin de promo n'existe dans les données ; un chrono inventé serait trompeur). Le bandeau affiche les promesses configurées par la boutique (eyebrow/tagline/annonce) et les badges de paiement à la livraison. Les badges de réduction n'apparaissent que si le produit a réellement un ancien prix supérieur ; sinon rien.

### 3. Mécanique des briques de mise en page

- Une table de configuration par thème (dans le module des thèmes, côté serveur) : `{hero, cards, nav, motif}` avec des valeurs fermées (ex. hero `split|bento|fullbleed|marquee|dunes|arch`).
- Le rendu pose `data-theme`, `data-hero`, `data-cards`, `data-motif` sur la racine ; le CSS module applique les variantes. Les éléments décoratifs (zellige, dunes, halos) sont des composants SVG/CSS purement décoratifs (`aria-hidden`).
- Vitrines : `app/vitrines/[slug]/page.tsx` et `/themes/[theme]` lisent la configuration. Boutiques indépendantes : `StorefrontTheme` pose les attributs ; les sections d'accueil (`ShopHomeSections`) et le catalogue sont stylés par variante sans changer leur logique.
- Les nouveaux thèmes indépendants ont chacun une couleur d'accent par défaut ajoutée à la liste fermée `accents` ; le texte du bouton (`appearanceAccentText`) est adapté si l'accent est clair.

### 4. Arabe / RTL

Chaque variante utilise des propriétés logiques (`inset-inline`, `margin-inline`, etc.) ; les éléments directionnels (carrousel, grille asymétrique) sont inversés en RTL. Police arabe existante (`arabic-font.ts`) conservée.

### 5. Galeries et démos

- Ajout des 6 codes à `storefrontThemeCodes`, aux `palettes`, aux `sectorPresets`, à `themes`/`appearanceThemeDetails` ; marquage « animé » pour tous.
- `/themes/{CODE}` : démonstration de chaque nouveau thème avec la mise en page propre ; textes de démo identifiés comme fictifs (règle existante).
- Galerie marchande et sélecteur de la landing : les nouveaux thèmes y apparaissent avec leur description.

## Vérification attendue

- Tests unitaires : nouvelles listes acceptées, CSS arbitraire toujours refusé, contraste AA des boutons pour les 20 palettes et les nouveaux accents, configuration de mise en page complète pour chaque code, ancien thème inconnu → repli `OASIS` / `classic`.
- Test HTTP des démos (`landing-theme-http`) étendu aux 20 thèmes.
- Captures navigateur bureau 1280 et mobile 390×844 de chaque nouveau thème et d'un échantillon d'anciens thèmes (avant/après), en FR et en AR, sans débordement horizontal ; contrôle du bouton pause et de `prefers-reduced-motion`.
- `npm run typecheck`, `npm test`, `npm run build` réussis.

## Laissé au constructeur

Valeurs exactes des palettes et des courbes d'animation, découpage des fichiers CSS (un fichier par thème est recommandé plutôt que d'allonger le fichier de 38 ko), noms internes des variantes, ordre des thèmes dans la galerie.

## Calls faits sans le porteur (à vérifier)

- Pas de compte à rebours dans Souk Flash (urgence inventée) ; remplacé par des promesses réelles.
- Bouton pause étendu à tous les thèmes.
- Codes `SOUK`/`souk` pour « Souk Flash ».
- Un fichier CSS par nouveau thème.
