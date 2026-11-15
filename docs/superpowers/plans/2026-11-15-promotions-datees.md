# Promotions datées — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** prix promo daté appliqué par le serveur et affiché en prix barré avec compte à rebours.
**Spec:** `docs/superpowers/specs/2026-11-15-promotions-datees-design.md`

## Review Focus
- Commande passée une seconde après `endsAt` → prix normal (Task 1).
- Prix normal baissé sous le prix promo après création → promo ignorée (Task 1).
- Offre de quantité moins avantageuse que la promo → ignorée (Task 1).
- Produit inconnu, fin dans le passé, prix promo ≥ prix normal → refus (Task 1).
- Arabe : compte à rebours et pourcentage lisibles en RTL (Task 3).

### Task 1: règle de prix (`modules/shops/promotions.ts`, `modules/commerce/service.ts`, `modules/platform/public.ts`)
`productPromotionPayload`, `productPromotionMutation`, `tunisLocalToIso(value:string):string`, `assertValidPromotion(regular:number,promo,now:Date)`, `activePromotion(product,now)`, `effectivePrice(product,now)`, `promotionView(product,now)` → `{regularPrice,endsAt,percent}|null` ; action `productPromotion` ; `createOrder` et `publicCatalog` utilisent le prix en vigueur. Tests : `tests/promotions.test.ts`.
### Task 2: API et écran marchand
`app/api/v1/shops/[shopId]/promotions/route.ts` (GET/POST, même protection que les offres de quantité) et `app/mes-boutiques/[shopId]/shop-promotions.tsx`, monté dans l'onglet Catalogue.
### Task 3: affichage vitrine
`components/promo-price.tsx` (prix barré, % et « Jusqu'au »), `components/promo-countdown.tsx` (client, en direct), branchés dans les cartes catalogue, la page produit, les boutiques indépendantes et l'aperçu ; compte à rebours visible sur les cartes en Souk Flash ; JSON-LD `priceValidUntil`.
### Task 4: recette
Base jetable : commande pendant et hors promo, captures FR/AR, tests, typecheck, build, doc `docs/tunicom-promotions.md`.
