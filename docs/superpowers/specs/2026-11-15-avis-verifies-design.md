# Avis clients vérifiés — conception

Date : 2026-11-15. Statut : option A (publication directe) approuvée par le porteur du projet.

## Intention
Rassurer les acheteurs avec des avis réels, uniquement de clients livrés, et donner à Google de vraies notes. Un avis négatif reste visible : le marchand répond publiquement. Seuls les abus sont masqués, après arbitrage du Super Admin.

## Approches
- **A. Publication directe** (retenue) : l'avis est publié tout de suite ; le marchand peut répondre et signaler ; un avis signalé est masqué jusqu'à la décision du Super Admin.
- B. Validation par le marchand : écartée, elle permet de cacher les avis négatifs et rend les notes trompeuses.

## Vérification d'achat
L'acheteur n'a pas de compte : la preuve est son lien de suivi privé (jeton `publicReceiptId` de la commande). Un avis n'est possible que si la commande est `DELIVERED`, pour un produit de cette commande, une seule fois par couple commande × produit (contrainte d'unicité en base).

## Données
Nouvelle table `ShopReview` (migration additive) : `id`, `shopId`, `productId`, `orderId`, `rating` (1–5), `comment` (≤ 1 000 caractères, texte brut), `authorName` (prénom + initiale du nom, tirés de la commande), `status` (`PUBLISHED` | `REPORTED` | `REMOVED`), `reportReason`, `reportedAt`, `merchantReply` (≤ 600), `repliedAt`, `moderatedAt`, `moderatedBy`, `createdAt`. Unicité `(shopId, orderId, productId)`, index `(shopId, productId, status)`. Une table plutôt que le JSON commercial : les lectures publiques, les moyennes et la modération inter-boutiques se font en SQL.

## Règles
- Commentaire : espaces normalisés, caractères de contrôle retirés ; les liens (`http`, `www.`) sont refusés pour bloquer le spam. Le commentaire est facultatif ; la note est obligatoire.
- Nom affiché : « Amira B. » ; jamais le téléphone ni l'adresse.
- Marchand : une réponse par avis (modifiable) ; signalement avec motif `ABUSE` | `PERSONAL_DATA` | `OFF_TOPIC` → statut `REPORTED`, masqué. Le marchand ne peut ni supprimer ni modifier un avis.
- Super Admin : liste des avis signalés de toutes les boutiques ; « Rétablir » (`PUBLISHED`) ou « Retirer » (`REMOVED`) ; chaque décision est inscrite au journal d'administration.
- Vitrine : moyenne, nombre d'avis et 10 derniers avis publiés sur la page produit, avec badge « Achat vérifié » et réponse du marchand ; « ★ 4,6 (12) » sur les cartes du catalogue. JSON-LD `aggregateRating` et `review` uniquement s'il existe au moins un avis publié.
- Arabe : libellés traduits, texte des avis en `dir="auto"`.

## Hors périmètre
Photos dans les avis, modification par l'acheteur, notifications par e-mail ou SMS, boutiques historiques `/boutiques/…` (elles n'ont pas de page produit).

## Calls du constructeur
Refus des liens dans les commentaires ; nom affiché en prénom + initiale ; 10 avis affichés par produit ; motifs de signalement fermés.
