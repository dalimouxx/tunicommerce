## v0.7 — Comptes clients

Inscription client, connexion et historique des commandes sur plusieurs appareils (`/compte`). Les nouvelles commandes passées avec une session CUSTOMER sont rattachées côté serveur ; aucun rattachement par téléphone/e-mail ou reprise automatique des commandes invitées. Les clients ne peuvent pas accéder aux API marchand/admin. Les liens privés de suivi restent utilisables et doivent rester confidentiels.

Migration additive `202611010001_customers` : relation facultative PublicReceipt → User, index chronologique. Les anciens reçus restent inchangés. Inscription sans validation e-mail ni récupération de mot de passe pour le moment ; aucune notification automatique. Le panier reste local au navigateur. Aucun nouveau service payant.

# 0.4.0 — 30 octobre 2026
Préparation du transfert vers GitHub et Render : Next.js Node.js, PostgreSQL/Prisma, migrations, compte propriétaire, mot de passe scrypt, sessions persistantes révocables, Origin strict, limite de taille réelle et limitation des connexions. Blueprint Render et workflow GitHub Actions. 39 tests locaux réussis et suite PostgreSQL à exécuter en CI. Code métier 0.3 conservé. Pas encore de déploiement Render.

Les documents docs/SITES-* sont des archives historiques de l’ancienne plateforme ; leurs mentions de stockage D1 et de connexion ChatGPT ne décrivent pas cette version.

## 0.5.0 — 2026-10-31

Boutiques publiques avec panier et commande COD, annuaire, rôle de superadministrateur, création de comptes marchands, gestion manuelle des abonnements et journal administratif. Migration additive sans effacement des données existantes. Nouvelles boutiques privées par défaut.

## 0.6.0 — 2026-10-31

Descriptions, médias HTTPS et identité de boutique ; sélection de variantes par SKU et catégories ; panier persistant par navigateur ; historique local des liens de suivi ; suivi privé des nouvelles commandes ; demandes d’annulation/retour et réponse du marchand. Aucun changement du schéma PostgreSQL.
