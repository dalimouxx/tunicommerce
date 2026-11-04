# TuniCommerce · Conditions de lancement commercial (4 novembre 2026)

Ce document accompagne les livraisons progressives de `dalimouxx/tunicommerce`. **Des workflows GitHub verts et un déploiement Render Live ne prouvent pas que toutes les opérations externes et tous les parcours utilisateur ont été testés en production.**

## Livraisons fonctionnelles à tester sur Render

- Administration SaaS globale, abonnements déclaratifs D17/virements/espèces, facturation administrative, supervision multi-boutique.
- Commerce marchand isolé : produits, stocks, commandes COD, Call Center, équipes, retours, frais de livraison, suivi de colis, rapprochements manuels.
- Vitrine publique : publication conditionnée à l'abonnement, panier COD, suivi client à lien confidentiel, trois thèmes, fiches produit SEO, codes promo.
- Gestion catalogue : édition, export CSV, import de 100 nouveaux SKU par opération avec validation des plafonds.
- Outils d'analyse privés : marges estimées, alertes et recommandations explicables (pas d'IA générative connectée).
- Exports transporteur et audit COD : **documents internes, pas de preuve d'acceptation du transporteur ou de virement bancaire**.

## Portes de validation bloquantes

1. **Multi-tenant** : au moins deux propriétaires, trois boutiques et plusieurs agents. Vérifier toutes les API, ID/slug et liens privés en essayant d'accéder aux données d'autres comptes.
2. **Parcours COD** : client commande avec/sans coupon, frais par gouvernorat, stock réservé, agent confirme, colis préparé/expédié, bon remis, livré, règlement déclaré, retour/remboursement partiel.
3. **Concurrence** : deux commandes simultanées sur le dernier stock, quotas SaaS aux limites, import CSV concurrent, et retries idempotents des opérations de paiement.
4. **Fonctionnel mobile** : page panier, calcul total, boutons d'équipe, usage sur smartphone réel, sons/notifications limités à l'onglet ouvert.
5. **Sauvegardes Neon** : vérifier une fréquence de snapshots automatique adaptée au contrat, créer un point de restauration puis **tester la restauration sur une branche isolée**, jamais directement sur la base active.
6. **Sécurité** : gestion des secrets Render, politiques de session, contrôle de contenu HTTPS, protection contre les injections CSV, limitation d'abus du checkout, permissions serveur.
7. **Transporteurs/communications/paiements** : contrats, sandbox/API documentés, webhook signé, idempotence, consentement SMS/WhatsApp, contrôle des relevés bancaires.
8. **Légal/commercial** : factures fiscales conformes aux exigences tunisiennes applicables, confidentialité/RGPD si pertinent, CGV, politique de retour, contrats de livraison et information des clients.
9. **Observabilité** : alertes incidents, procédures de restauration, support et suivi des erreurs Render, vérification du renouvellement des abonnements.

## État Neon observé lors de cette session

- Projet `tiny-resonance-64096818`, branche principale de test `br-aged-dream-ba2vrcvl`.
- Lors de la lecture du 4 novembre 2026, **aucun calendrier de snapshots automatiques n'était configuré**.
- Un snapshot manuel daté du 3 novembre 2026 figurait dans la liste. Vérifier la rétention et une restauration sûre avant commercialisation.
- Aucune modification de la politique Neon ou de données marchands n'est effectuée par ce document.

## Ce qui n'est PAS encore une intégration réelle

- Les API d'expédition des transporteurs tunisiens, la synchronisation de leurs scans ou la génération d'étiquettes officielles.
- L'envoi automatique SMS/WhatsApp, téléphonie et notifications push mobiles permanentes.
- La confirmation bancaire automatique du COD, le prélèvement récurrent par carte et les factures fiscales certifiées.
- Le Commerce Copilot génératif, les scores de confiance automatisés, l'éditeur visuel drag-and-drop ou les domaines personnalisés.

**Décision de lancement :** ne passer de `pilotage` à `commercial` qu'après preuve documentaire de ces contrôles. Le propriétaire choisit les partenaires, les coûts et les modalités de sauvegarde ; aucun service tiers ne doit être activé implicitement.
