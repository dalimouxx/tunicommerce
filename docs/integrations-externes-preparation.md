# TuniCommerce · Intégrations externes à activer

**État au 4 novembre 2026 : non connectées.** Les fonctions actuelles de livraison, d'historique des contacts et de rapprochement COD restent essentiellement manuelles.

Le tableau `/admin/integrations` affiche **la présence des variables d'environnement**, pas la réussite d'une connexion fournisseur. Il ne lit jamais les valeurs dans le navigateur.

## À fournir avant intégration

| Domaine | Prérequis |
| --- | --- |
| Transport | Nom de société tunisienne, documentation API contractuelle, sandbox, authentification, spécifications d'étiquettes, suivi et retours |
| SMS | Contrat fournisseur, identifiant expéditeur, API sandbox, limites d'envoi, consentement et modèles |
| WhatsApp | Compte WhatsApp Business/API, numéro validé, token, templates de messages approuvés, consentements et règles de fenêtre de conversation |
| Téléphonie | Compte SIP/CTI/VoIP, processus d'enregistrement légal et consentement ; aucun appel automatique sans configuration |
| Banque | Format des relevés/API, accès autorisé, méthodes de rapprochement, contrôles humains et états d'anomalie |
| IA | Prestataire, modèle, clé facturée à l'usage, politique de rétention, minimisation des données commerciales et opt-in explicite |

## Environnement Render

Définir les secrets dans les variables serveur **du service Render**, pas dans GitHub, pas dans un ticket, pas dans le navigateur.

Variables indicatives utilisées par le diagnostic de préparation :

- `TUNICOMMERCE_CARRIER_API_BASE_URL` et `TUNICOMMERCE_CARRIER_API_TOKEN`
- `TUNICOMMERCE_SMS_API_KEY` et `TUNICOMMERCE_SMS_SENDER_ID`
- `TUNICOMMERCE_WHATSAPP_API_TOKEN` et `TUNICOMMERCE_WHATSAPP_PHONE_ID`
- `TUNICOMMERCE_BANK_RECONCILIATION_API_TOKEN`
- `TUNICOMMERCE_AI_API_KEY` et `TUNICOMMERCE_AI_MODEL`

**Ces noms ne déclenchent pas d'envoi, d'appel, de rapprochement bancaire ou de réponse LLM.** Les adaptateurs doivent être implémentés sur la base des spécifications du fournisseur choisi, avec signatures vérifiées, retries idempotents, quotas et tests en sandbox avant activation.

## Vérifications obligatoires

1. Isolation stricte des données des boutiques et des rôles lors de la réception de webhook.
2. Vérification cryptographique des signatures et de la validité des événements.
3. Protection contre les doublons et gestion de l'ordre inversé des événements.
4. Aucune modification de stock ou de COD sur simple message non vérifié.
5. Consentement et traçabilité des communications.
6. Réconciliation des montants bancaires avec résolution explicite des écarts.
7. Rotation/révocation de secrets et suppression des logs contenant des données personnelles.

L'objectif est d'éviter de faire croire qu'une notification locale, une déclaration manuelle ou un export CSV équivaut à une intégration réelle.
