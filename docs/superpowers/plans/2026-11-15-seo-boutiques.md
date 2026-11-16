# SEO des boutiques — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** robots, sitemap (plateforme et domaine), canonique, Open Graph et JSON-LD pour les vitrines et les boutiques indépendantes.
**Architecture:** fonctions pures dans `modules/seo/*` (testées unitairement), chargeurs Prisma minces, routes de métadonnées Next et deux routes publiques par boutique, réécrites par le proxy pour les domaines personnalisés.
**Tech Stack:** Next.js 16 (MetadataRoute), Prisma 7, `node:test`.
**Spec:** `docs/superpowers/specs/2026-11-15-seo-boutiques-design.md`

## Global Constraints
- Ne lister que le contenu public selon `isPublicIsolatedShop` / `isOpen` ; jamais de données privées (coût, stock exact, clients).
- Prix en millimes (entiers) → `(price/1000).toFixed(3)`, devise `TND`.
- JSON-LD échappé (`<`, `>`, `&`, U+2028, U+2029) ; aucune `aggregateRating` ni `review`.
- URL absolues bâties depuis `applicationOrigin()` ou le domaine personnalisé actif.

## Review Focus
- Boutique publiée puis suspendue ou expirée : disparaît du sitemap (test Task 2).
- Nom de produit contenant `</script><script>` : JSON-LD inoffensif (test Task 1).
- Image interne `/api/media/products/...` : rendue absolue dans OG et JSON-LD (test Task 1).
- Domaine personnalisé : `/sitemap.xml` réécrit vers la boutique, les autres chemins restent refusés (test Task 3).
- Catalogue de démonstration : jamais indexé (test Task 2).

### Task 1: Fonctions pures SEO
**Files:** Create `modules/seo/structured-data.ts`, `modules/seo/urls.ts` ; Test `tests/seo-structured-data.test.ts`
**Produces:** `jsonLdScript(data:unknown):string` ; `absoluteUrl(origin:string,path:string):string` (laisse intactes les URL `https:`) ; `productJsonLd(input:{name:string;description:string;imageUrl:string;url:string;price:number;available:boolean;storeName:string;origin:string})` ; `storeJsonLd(input:{name:string;description:string;url:string;logoUrl:string;origin:string})` ; `storefrontAlternates(origin:string,path:string)` → `{canonical, languages:{fr, ar}}`.
- [ ] Tests : `</script>` échappé (`</script`) ; prix 89000 → `"89.000"`, `priceCurrency:"TND"`, availability `InStock`/`OutOfStock` ; image interne rendue absolue ; aucune clé `aggregateRating` ; alternates `?lang=ar`.
- [ ] RED → implémenter → GREEN → commit `feat(seo): données structurées et URL absolues`.

### Task 2: Sitemaps et robots
**Files:** Create `modules/seo/sitemap.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/api/v1/public/seo/[slug]/sitemap/route.ts`, `app/api/v1/public/seo/[slug]/robots/route.ts`, `modules/seo/canonical.ts` ; Test `tests/seo-sitemap.test.ts`
**Produces:** `type SitemapShop={kind:'vitrine'|'boutique';slug:string;public:boolean;demo:boolean;customHost:string|null;products:{id:string;available:boolean}[];pages:string[];updatedAt:Date}` ; `platformSitemapEntries(origin:string,shops:SitemapShop[]):{url:string;lastModified?:Date}[]` ; `shopSitemapEntries(origin:string,shop:SitemapShop):…` ; `robotsBody(origin:string):string` (pour les domaines) ; `platformRobots(origin)` (MetadataRoute.Robots) ; `canonicalOrigin(shopId:string):Promise<string>` (domaine vérifié routé sinon `applicationOrigin()`) ; chargeur `loadSitemapShops()`.
- [ ] Tests purs : boutique non publique / démo exclues ; produits indisponibles exclus ; boutique à domaine personnalisé absente du sitemap plateforme mais présente (URL sur son domaine) dans `shopSitemapEntries` ; robots interdit `/admin` et `/api` et cite le sitemap.
- [ ] RED → implémenter → GREEN → commit `feat(seo): sitemap et robots`.

### Task 3: Domaines personnalisés
**Files:** Modify `modules/shops/domain-path-policy.ts` ; Test `tests/domain-path-policy.test.ts` (ou le test existant de la politique)
- [ ] Tests : `GET /robots.txt` et `/sitemap.xml` sur domaine → `rewrite` vers `/api/v1/public/seo/{slug}/robots|sitemap` (vitrine et boutique historique) ; `POST /sitemap.xml` → `deny`.
- [ ] RED → implémenter → GREEN → commit `feat(seo): robots et sitemap des domaines personnalisés`.

### Task 4: Métadonnées des pages
**Files:** Modify `app/vitrines/[slug]/page.tsx`, `app/vitrines/[slug]/produit/[productId]/page.tsx`, `app/boutiques/[slug]/page.tsx`
- [ ] `generateMetadata` : `alternates`, `openGraph.images`, `twitter.card='summary_large_image'` ; `<script type="application/ld+json">` via `jsonLdScript` (Product sur la page produit, Store sur l'accueil).
- [ ] Test : vérification HTTP sur base jetable (canonique, og:image, JSON-LD parsable, aucune note) ; `npm test`, typecheck, build.
- [ ] Commit `feat(seo): canonique, Open Graph et JSON-LD des vitrines` ; doc `docs/tunicom-seo.md`.
