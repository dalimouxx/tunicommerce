# Thèmes de boutique pro et animés — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une couche d'animation commune à tous les thèmes de vitrine et six nouveaux thèmes (Médina, Sahara, Bento, Souk Flash, Aurora, Magazine) avec leur propre mise en page, pour les vitrines `/vitrines/[slug]`, les démos `/themes/[theme]` et les boutiques indépendantes `/boutiques/[slug]`.

**Architecture:** Une table serveur fermée associe chaque thème à des variantes de mise en page (`hero`, `cards`, `motif`). Les pages posent ces variantes en attributs `data-*` et des attributs stables `data-part` sur leurs éléments ; un module CSS par nouveau thème stylise ces parties. Un composant client unique gère l'apparition au défilement ; tout le reste est en CSS (transform/opacity). Panier, checkout et catalogue ne changent pas de logique.

**Tech Stack:** Next.js 16.4 App Router, React 19, TypeScript, CSS Modules, Zod, `node:test` (via `npm test`), Playwright (captures).

**Spec:** `docs/superpowers/specs/2026-11-14-themes-pro-animes-design.md`

## Global Constraints

- Lire `node_modules/next/dist/docs/` pour toute API Next utilisée (AGENTS.md).
- Aucune dépendance npm ajoutée ; aucune image ni police distante ; décors en SVG/CSS inline `aria-hidden="true"`.
- Thèmes = préréglages fermés : codes validés par Zod, jamais de CSS fourni par le marchand.
- Contraste bouton (accent / accentText) ≥ 4,5:1 pour chaque palette et accent ; les accents des palettes vitrines restent uniques.
- `prefers-reduced-motion: reduce` et `[data-motion="paused"]` coupent toutes les animations et laissent le contenu visible.
- Aucun contenu n'est masqué sans JS : l'état caché de l'apparition n'existe que sous `[data-reveal-ready]`, posé par le script.
- Aucune animation ne déplace un bouton d'achat ou un champ du checkout.
- Pas de compte à rebours ni de stock/urgence inventés ; badges promo uniquement depuis les offres de quantité réelles (`offers`).
- Propriétés logiques CSS (`inline`/`block`) ; animations directionnelles inversées sous `[dir="rtl"]`.
- Textes visibles en français (et arabe via `storefront-i18n` pour les vitrines) ; les démos restent identifiées « Démonstration / produits fictifs ».
- Codes : vitrines `MEDINA SAHARA BENTO SOUK AURORA MAGAZINE`, indépendants `medina sahara bento souk aurora magazine`.

## Review Focus

- Thème inconnu / ancien enregistrement → repli `OASIS` / `classic` sans erreur (test Task 1 et 2).
- Arabe (RTL) sur chaque nouveau thème : pas de débordement horizontal, bandeau défilant dans le bon sens (capture Task 7).
- Mobile 390 px : grilles Bento/Magazine qui retombent en une colonne lisible, sans scroll horizontal (capture Task 7).
- Boutique sans produit, sans logo, sans bannière, sans catégories : décors et tuiles Bento/Souk ne laissent pas de case vide cassée (test HTTP Task 4 + capture Task 7).
- `backdrop-filter` non supporté (Aurora) : cartes lisibles grâce au fond opaque de repli (`@supports not`) (Task 5).

---

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `modules/shops/storefront-themes.ts` (modifier) | 6 codes + palettes + secteurs ; `animatedStorefrontTheme` → vrai pour tous |
| `modules/shops/theme-layouts.ts` (créer) | Table des variantes de mise en page par thème |
| `modules/appearance/validation.ts`, `theme-catalog.ts` (modifier) | 6 thèmes indépendants + 6 accents |
| `components/storefront-reveal.tsx` (créer) | Script client d'apparition au défilement |
| `components/storefront-motion.module.css` (créer) | Couche d'animation commune |
| `components/theme-motif.tsx` (créer) | Décors SVG/CSS : zellige, dunes, aurora, grain magazine |
| `components/theme-hero-extras.tsx` (créer) | Tuiles Bento et bande produits Souk (vitrines + démos) |
| `components/storefront-themes/{medina,sahara,bento,souk,aurora,magazine}.module.css` (créer) | Styles propres à chaque nouveau thème (vitrines + boutiques indépendantes) |
| `components/storefront-themes/index.ts` (créer) | `themeClass(code)` → classe racine du module du thème |
| `app/vitrines/[slug]/page.tsx`, `catalog-browser.tsx` (modifier) | Attributs `data-*`, `data-part`, motif, extras, révélation, badge d'offre |
| `modules/shops/public-catalog-filters.ts` (modifier) | `offers?` optionnel sur `CatalogProduct` |
| `app/themes/[theme]/page.tsx` (modifier) | Démos des nouveaux thèmes |
| `components/storefront-theme.tsx`, `components/public-shop.tsx` (modifier) | Boutiques indépendantes : attributs, motif, révélation, bouton pause |
| `components/tunicom-landing.tsx` (modifier) | Les 6 nouveaux thèmes dans le sélecteur |

---

### Task 1: Codes vitrines et table de mise en page

**Files:**
- Modify: `modules/shops/storefront-themes.ts`
- Create: `modules/shops/theme-layouts.ts`
- Test: `tests/isolated-storefront-themes.test.ts`, create `tests/theme-layouts.test.ts`

**Interfaces:**
- Produces:
  - `storefrontThemeCodes` étendu à 20 codes (ordre : 14 existants puis `MEDINA,SAHARA,BENTO,SOUK,AURORA,MAGAZINE`).
  - `type ThemeLayout={hero:'split'|'bento'|'fullbleed'|'arch'|'dunes'|'marquee';cards:'standard'|'lift'|'glass'|'editorial'|'flash'|'tile';motif:'none'|'zellige'|'dunes'|'aurora'|'grain'|'stripes'}`
  - `storefrontLayout(code:unknown):ThemeLayout` (inconnu → layout d'`OASIS`) dans `theme-layouts.ts`.
  - `appearanceLayout(theme:unknown):ThemeLayout` (codes minuscules ; inconnu → `classic`).
  - `isNewLayoutTheme(code:unknown):boolean` vrai pour les 6 nouveaux codes (majuscules ou minuscules).

Valeurs fixées : anciens thèmes `{hero:'split',cards:'lift',motif:'none'}` ; MEDINA `{arch,tile,zellige}` ; SAHARA `{dunes,editorial,dunes}` ; BENTO `{bento,tile,none}` ; SOUK `{marquee,flash,stripes}` ; AURORA `{split,glass,aurora}` ; MAGAZINE `{fullbleed,editorial,grain}`.

Palettes (fond, texte, accent, texte accent, surface, atténué) — le constructeur peut ajuster les teintes si le contraste l'exige :
MEDINA `#f7f1e6,#1d2a44,#1f4fa0,#ffffff,#fffaf1,#5b6377` · SAHARA `#f4e9da,#3a2617,#9a4a1c,#ffffff,#fbf4ea,#7a5d47` · BENTO `#f5f5f7,#111114,#0a66d9,#ffffff,#ffffff,#5d5d66` · SOUK `#fff8e1,#1b1b1b,#d7261e,#ffffff,#ffffff,#5a5148` · AURORA `#0f0d1d,#f4f1ff,#e8a6ff,#1b0f24,#1b1830,#c9c2e3` · MAGAZINE `#fbfaf7,#141414,#141414,#ffffff,#ffffff,#5f5f5f`.

Secteurs : FASHION + `SOUK,MAGAZINE,SAHARA` ; BEAUTY + `AURORA,SAHARA` ; TECH + `BENTO,AURORA` ; HOME + `MEDINA` ; LUXURY + `SAHARA,MAGAZINE` ; WELLNESS + `SAHARA,MEDINA`.

- [ ] **Step 1: Mettre à jour les tests existants** — dans `tests/isolated-storefront-themes.test.ts`, `assert.equal(all.length,20)` ; ajouter un test `'six new layout themes are selectable and persist'` qui, pour chaque nouveau code, vérifie `storefrontThemeInput.safeParse(...)`, `applyAction(...,'saveStorefrontTheme',{theme:code})` puis `isolatedStorefrontPreview(next).theme.code===code`. Le test de contraste existant couvre automatiquement les 20 codes.
- [ ] **Step 2: Écrire `tests/theme-layouts.test.ts`**
```ts
test('every storefront code has a closed layout',()=>{
 for(const code of storefrontThemeCodes){const l=storefrontLayout(code);
  assert.ok(['split','bento','fullbleed','arch','dunes','marquee'].includes(l.hero));}
 assert.deepEqual(storefrontLayout('BENTO'),{hero:'bento',cards:'tile',motif:'none'});
 assert.deepEqual(storefrontLayout('url(x)'),storefrontLayout('OASIS'));
});
test('appearance themes map to layouts and fall back to classic',()=>{
 for(const t of themes)assert.ok(appearanceLayout(t));
 assert.deepEqual(appearanceLayout('souk'),{hero:'marquee',cards:'flash',motif:'stripes'});
 assert.deepEqual(appearanceLayout('nope'),appearanceLayout('classic'));
 assert.equal(isNewLayoutTheme('MEDINA'),true);assert.equal(isNewLayoutTheme('OASIS'),false);
});
test('all themes are animated',()=>{for(const c of storefrontThemeCodes)assert.equal(animatedStorefrontTheme(c),true);});
```
- [ ] **Step 3: Lancer** `node --import tsx --test tests/theme-layouts.test.ts tests/isolated-storefront-themes.test.ts` → FAIL (module absent, 14≠20).
- [ ] **Step 4: Implémenter** codes, palettes, secteurs, `animatedStorefrontTheme` (vrai pour tout code valide), `theme-layouts.ts`. `appearanceLayout` dépend de Task 2 pour les clés minuscules : définir la table minuscule ici (`classic editorial prestige pop pulse sorbet chrome groove` → layout ancien) et les 6 nouvelles.
- [ ] **Step 5: Relancer** → PASS (le test `appearanceLayout` sur `themes` passera après Task 2 ; marquer cet `assert` pour Task 2 si exécuté avant).
- [ ] **Step 6: Commit** `feat(themes): six codes vitrine et table de mise en page`

### Task 2: Thèmes des boutiques indépendantes

**Files:**
- Modify: `modules/appearance/validation.ts`, `modules/appearance/theme-catalog.ts`
- Test: `tests/appearance-validation.test.ts`

**Interfaces:**
- Produces: `themes` (14 valeurs, nouvelles à la fin), `accents` (16 valeurs : +`#1F4FA0 #9A4A1C #0A66D9 #D7261E #E8A6FF #141414`), `appearanceThemeDetails[theme]` avec `animated:true` pour tous et `accent` par défaut pour les 6 nouveaux (mêmes valeurs que les palettes Task 1), `appearanceAccentText(accent)` → `#1B0F24` pour `#E8A6FF`, `#141812` pour `#C9FF4A`, sinon `#FFFFFF`.

Descriptions : Médina « Zellige et arches · artisanat, déco et cadeaux » ; Sahara « Dunes et lumière dorée · mode, parfums et bien-être » ; Bento « Mosaïque nette · tech et accessoires » ; Souk Flash « Promos franches · ventes rapides et paiement à la livraison » ; Aurora « Lumières et verre dépoli · beauté et jeunes marques » ; Magazine « Grande image, titres géants · mode et créateurs ».

- [ ] **Step 1: Tests** — `themes.length` 14, `accents.length` 16 ; nouveau test : pour chaque nouveau thème, `appearanceSchema.parse({...valid,theme,accent:preset.accent})` réussit, `readPresentation` relit thème et accent ; pour chaque accent, contraste `accent`/`appearanceAccentText(accent)` ≥ 4,5 (réutiliser la fonction de luminance du test vitrines).
- [ ] **Step 2: Lancer** `node --import tsx --test tests/appearance-validation.test.ts tests/theme-layouts.test.ts` → FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Relancer** → PASS ; puis `npm run typecheck` (le `Record<StoreTheme,…>` impose les 6 entrées).
- [ ] **Step 5: Commit** `feat(themes): six thèmes pour les boutiques indépendantes`

### Task 3: Couche d'animation commune

**Files:**
- Create: `components/storefront-reveal.tsx`, `components/storefront-motion.module.css`
- Modify: `app/vitrines/[slug]/page.tsx`, `app/vitrines/[slug]/catalog-browser.tsx`, `components/storefront-theme.tsx`, `components/public-shop.tsx`, `app/vitrines/[slug]/public-cart.tsx` (rebond du compteur seulement)
- Test: create `tests/storefront-motion-css.test.ts`

**Interfaces:**
- Produces:
  - `StorefrontReveal()` : composant client sans rendu visible ; au montage, trouve la racine `[data-motion-root]`, pose `data-reveal-ready`, observe `[data-reveal]` et pose `data-visible="true"` à l'entrée (seuil 0,12, `rootMargin` `0px 0px -8% 0px`) ; sans `IntersectionObserver`, marque tout visible.
  - Classe `motion.root` (module) posée sur la racine des vitrines et de `StorefrontTheme`.
  - Attributs utilisés par tous les thèmes : `data-motion-root` sur la racine ; `data-reveal` sur sections, cartes produits ; `style={{'--i':index}}` sur les cartes (délai `min(--i,8)*60ms`) ; `data-part` ∈ `announcement header hero hero-copy hero-visual pillars catalog product-grid product-card product-media cta footer`.

Effets : apparition (opacity 0→1, translateY 18px→0, 520 ms, `cubic-bezier(.2,.7,.2,1)`) ; carte au survol `translateY(-4px)` + ombre + photo `scale(1.04)` (seulement `@media (hover:hover)`) ; `cta:active` `scale(.97)` ; en-tête `position:sticky` avec fond semi-transparent et `backdrop-filter: blur(12px)` quand `[data-scrolled]` (posé par `StorefrontReveal` après 24 px de défilement) ; compteur panier `@keyframes bump` déclenché en changeant sa `key` à chaque ajout.

Bouton pause : `StorefrontMotionToggle` affiché pour tous les thèmes (vitrines via `animatedStorefrontTheme`, indépendants via `appearanceThemeDetails[].animated`).

- [ ] **Step 1: Test CSS statique** `tests/storefront-motion-css.test.ts` : lit `components/storefront-motion.module.css` et vérifie qu'il contient `@media (prefers-reduced-motion: reduce)`, `[data-motion="paused"]`, et que la règle cachant `[data-reveal]` est préfixée par `[data-reveal-ready]` (regex `/\[data-reveal-ready\][^{]*\[data-reveal\]/`) et qu'aucune règle `opacity:0` n'existe hors de ce préfixe.
- [ ] **Step 2: Lancer** → FAIL (fichier absent).
- [ ] **Step 3: Implémenter** le module CSS, `StorefrontReveal`, puis poser racine/attributs dans les vitrines (page + catalogue), `StorefrontTheme` et `public-shop.tsx` (`product-tile` → `data-reveal data-part="product-card"`).
- [ ] **Step 4: Relancer** le test + `npm run typecheck` + `npm test` → PASS.
- [ ] **Step 5: Vérification visuelle rapide** : `npm run dev` puis capture `/themes/OASIS` défilée ; le contenu est visible, les cartes apparaissent.
- [ ] **Step 6: Commit** `feat(themes): couche d'animation commune et pause pour tous les thèmes`

### Task 4: Briques de mise en page des vitrines (décors et extras)

**Files:**
- Create: `components/theme-motif.tsx`, `components/theme-hero-extras.tsx`, `components/storefront-themes/index.ts`
- Modify: `app/vitrines/[slug]/page.tsx`, `app/vitrines/[slug]/catalog-browser.tsx`, `modules/shops/public-catalog-filters.ts`, `modules/shops/storefront-i18n.ts`
- Test: create `tests/theme-hero-extras.test.tsx` (rendu via `react-dom/server` `renderToStaticMarkup`)

**Interfaces:**
- Consumes: `storefrontLayout` (Task 1), `data-part` (Task 3).
- Produces:
  - `ThemeMotif({motif}:{motif:ThemeLayout['motif']})` → `null` pour `none`, sinon un `<div data-part="motif" aria-hidden="true">` contenant le SVG/les calques du motif.
  - `ThemeHeroExtras({layout,products,categories,lang,shopPath})` où `products:{id:string;name:string;price:number;imageUrl?:string;available:boolean;offers?:{quantity:number;price:number;label:string}[]}[]` ; `bento` → tuiles `data-part="bento-tile"` (catégories si ≥1, produit vedette si disponible, promesse COD toujours) ; `marquee` → bande `data-part="souk-strip"` de 6 produits disponibles max (liste dupliquée `aria-hidden` pour la boucle) ; autres → `null`. Aucune tuile vide : une tuile n'est rendue que si sa donnée existe.
  - `themeClass(code:string):string` (index) → classe `.root` du module du thème, `''` pour les anciens.
  - `CatalogProduct.offers?` ; badge `data-part="offer-badge"` rendu dans la carte quand `offers?.length`, texte `t.offerBadge(offers[0].quantity,price)` (FR « {q} pièces · {prix} », AR équivalent).
- Racine vitrine : `data-hero`, `data-cards`, `data-motif` + `className` incluant `themeClass(theme.code)`.

- [ ] **Step 1: Tests de rendu** : `bento` sans catégories ni produit → seule la tuile COD ; `bento` complet → 3 tuiles ; `marquee` avec 0 produit disponible → `null` ; `marquee` avec 9 produits → 6 noms uniques ; `split` → `null` ; `ThemeMotif` `zellige` contient `aria-hidden="true"`.
- [ ] **Step 2: Lancer** `node --import tsx --test tests/theme-hero-extras.test.tsx` → FAIL. (Si `npm test` ne ramasse pas les `.test.tsx`, vérifier `scripts/test-suite.mjs` et l'y ajouter.)
- [ ] **Step 3: Implémenter** composants, i18n (`offerBadge`, libellés des tuiles : « Paiement à la livraison », « Livraison partout en Tunisie », « Catégories », « Coup de cœur »), branchement dans la page vitrine (extras dans `hero-visual` pour `bento`/`marquee`, motif en premier enfant du hero).
- [ ] **Step 4: Relancer** → PASS ; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(themes): décors et tuiles de mise en page des vitrines`

### Task 5: Styles des six nouveaux thèmes

**Files:**
- Create: `components/storefront-themes/{medina,sahara,bento,souk,aurora,magazine}.module.css`
- Modify: `components/storefront-themes/index.ts`
- Test: étendre `tests/storefront-motion-css.test.ts`

Chaque module exporte `.root` et stylise **deux DOM** : vitrines (`.root [data-part=…]`) et boutiques indépendantes (`.root :global(.platform-hero)`, `:global(.product-tile)`, `:global(.public-grid)`, `:global(.checkout)` — styles visuels seulement, jamais `display:none` sur le checkout).

Signatures à réaliser :
- **Médina** : motif zellige (étoile à 8 branches en SVG) tracé par `stroke-dashoffset` 2,4 s ; visuel du hero en arche (`border-radius` 999px 999px 24px 24px) ; filets dorés `#c9a24a` ; cartes tuiles à liseré.
- **Sahara** : 3 calques de dunes (SVG `path`) en dégradé qui ondulent (`translateX` lent, 18–30 s, alterné) ; titres fins `font-weight:300`, `letter-spacing:.04em` ; cartes éditoriales sans bordure.
- **Bento** : hero en grille 4×2 (`grid-template-areas`) avec copy 2×2, visuel et tuiles ; cases `border-radius:28px` qui se soulèvent au survol ; grille produits avec 1ʳᵉ carte 2×2 à partir de 900 px ; une colonne sous 640 px.
- **Souk Flash** : annonce en marquee infini (`translateX`, sens inversé en RTL), bandes diagonales `repeating-linear-gradient` sur le hero, badges COD/livraison tamponnés (légère rotation), bande produits défilante (pause au survol/focus), cartes `flash` contraste fort avec badge d'offre visible (masqué par défaut dans les autres thèmes).
- **Aurora** : 3 halos flous (`filter: blur(60px)`, `radial-gradient`) qui dérivent 20–28 s ; cartes en verre (`backdrop-filter: blur(16px)`, fond `rgb(255 255 255 / .08)`) avec `@supports not (backdrop-filter: blur(1px))` → fond `var(--store-surface)` opaque.
- **Magazine** : hero plein écran (image en `object-fit:cover`, titre géant serif `clamp(3rem,9vw,8rem)` posé dessus avec voile pour le contraste), grain SVG en surimpression, grille asymétrique (`nth-child(5n+1)` sur 2 colonnes) et numérotation des cartes via `counter()`.

- [ ] **Step 1: Test statique** : pour chaque fichier, présence de `.root`, d'un bloc `prefers-reduced-motion`, aucun `url(http` ; Aurora contient `@supports not`; Souk contient `[dir="rtl"]` ; `offer-badge` caché par défaut dans `storefront-motion.module.css` et visible dans `souk.module.css`.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Écrire les six modules** et `themeClass`.
- [ ] **Step 4: Relancer** + `npm test` + `npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(themes): styles Médina, Sahara, Bento, Souk Flash, Aurora et Magazine`

### Task 6: Démos, boutiques indépendantes et galeries

**Files:**
- Modify: `app/themes/[theme]/page.tsx`, `components/storefront-theme.tsx`, `components/public-shop.tsx`, `components/tunicom-landing.tsx`
- Test: `tests/landing-theme-http.test.ts`

**Interfaces:**
- Consumes: `storefrontLayout`, `appearanceLayout`, `ThemeMotif`, `ThemeHeroExtras`, `themeClass`, `StorefrontReveal`.
- Démos : mêmes attributs/décors que la vitrine ; titres : MEDINA « L'artisanat, en lumière. », SAHARA « La chaleur du désert. », BENTO « Tout. Simplement. », SOUK « Les bons plans du souk. », AURORA « Ta routine, en couleur. », MAGAZINE « Le style, en grand. » ; `kind` : MEDINA/SAHARA/AURORA `bottle`, BENTO `audio`, SOUK/MAGAZINE `shoe` ; produits de démo avec une offre de quantité fictive pour montrer le badge Souk, signalés comme fictifs.
- `StorefrontTheme` : `data-hero/data-cards/data-motif` depuis `appearanceLayout`, classe `themeClass(theme)`, `ThemeMotif`, `StorefrontReveal`.
- Landing : ajouter les 6 thèmes au tableau `newThemes` (mêmes champs que les existants) sans changer le reste du design.

- [ ] **Step 1: Test HTTP** : le titre du test passe à « twenty » ; la boucle couvre les 20 codes ; pour `BENTO` le HTML contient `data-hero="bento"` ; pour `SOUK` `data-part="souk-strip"` ; landing contient `href="/themes/MEDINA"`.
- [ ] **Step 2: Lancer** `node --import tsx --test tests/landing-theme-http.test.ts` → FAIL (après `npm run build` si le test l'exige ; suivre l'en-tête du test).
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Relancer** → PASS ; `npm test` ; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(themes): démos, boutiques indépendantes et galerie de la landing`

### Task 7: Recette visuelle et livraison

**Files:**
- Create: `docs/tunicom-themes-pro.md` (fonctionnement des briques, liste des thèmes, limites)
- Captures dans le scratchpad (non commitées)

- [ ] **Step 1:** `npm run build` et `npm test` → réussis.
- [ ] **Step 2:** Captures Playwright de `/themes/{MEDINA,SAHARA,BENTO,SOUK,AURORA,MAGAZINE}` en 1280×900 et 390×844, plus `OASIS` et `PULSE` (avant/après) ; vérifier `document.documentElement.scrollWidth<=innerWidth` sur chaque page.
- [ ] **Step 3:** Même contrôle avec `?lang=ar` sur une vitrine de test si une base est disponible ; sinon vérifier le RTL sur la démo en forçant `dir="rtl"` via Playwright et le noter comme limite.
- [ ] **Step 4:** Contrôle `prefers-reduced-motion` (`page.emulateMedia({reducedMotion:'reduce'})`) : tout le contenu visible, aucune animation en cours (`document.getAnimations().length===0`).
- [ ] **Step 5:** Rédiger `docs/tunicom-themes-pro.md` ; commit `docs(themes): thèmes pro et animés` ; push.
