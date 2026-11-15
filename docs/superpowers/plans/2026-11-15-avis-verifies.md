# Avis clients vérifiés — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.
**Spec:** `docs/superpowers/specs/2026-11-15-avis-verifies-design.md`

## Review Focus
- Jeton de suivi d'une autre boutique, commande non livrée, produit absent de la commande → refus (Task 2).
- Double envoi du même avis → un seul avis (contrainte d'unicité, Task 2).
- Commentaire avec `</script>` ou un lien → texte inoffensif ou refus (Tasks 1 et 4).
- Avis signalé ou retiré : absent de la vitrine, de la moyenne et du JSON-LD (Task 2).
- Marchand d'une autre boutique → 404 sur répondre ou signaler (Task 2).

### Task 1: modèle et règles pures
Migration `prisma/migrations/202611150001_shop_reviews`, modèle `ShopReview`. `modules/reviews/policy.ts` : `reviewInput`, `merchantReplyInput`, `reportInput`, `moderationInput`, `cleanComment`, `displayName(fullName)`, `ratingSummary(rows)`, `reviewJsonLd(summary, items)`. Tests : `tests/reviews-policy.test.ts`.
### Task 2: services
`modules/reviews/service.ts` : `submitReview(slug, token, input)`, `productReviews(shopId, productId)`, `shopRatings(shopId)`, `merchantReviews(userId, shopId)`, `replyToReview`, `reportReview`, `reportedReviews()`, `moderateReview(adminId, id, decision)`. Test d'intégration PostgreSQL : `tests/reviews-api.test.ts`.
### Task 3: routes
`POST /api/v1/public/vitrines/[slug]/suivi/[token]/avis`, `GET/POST /api/v1/shops/[shopId]/reviews`, `GET/POST /api/admin/reviews` ; inventaire des routes.
### Task 4: interfaces
Formulaire sur la page de suivi, section avis de la page produit, étoiles sur les cartes, JSON-LD, section « Avis clients » dans Mes boutiques, page `/admin/avis` et lien dans le menu.
### Task 5: recette
Base jetable : avis réel via le lien de suivi, réponse, signalement, arbitrage ; captures FR/AR ; tests, typecheck, build ; `docs/tunicom-avis.md`.
