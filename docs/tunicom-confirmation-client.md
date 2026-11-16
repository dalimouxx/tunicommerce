# Confirmation des commandes par le client

Conception : [specs/2026-11-16-confirmation-client-design.md](superpowers/specs/2026-11-16-confirmation-client-design.md).

## Pour le marchand ou l'agent du call center
Mes boutiques › Call center › file de confirmation › **« Demander la confirmation (WhatsApp) »** sur une commande « À confirmer », « Pas de réponse » ou « À rappeler ». WhatsApp s'ouvre sur le numéro du client avec un message pré-rempli : boutique, référence, articles, total à payer et lien personnel (valable 7 jours, réutilisé tant qu'il est valable). Il suffit d'appuyer sur Envoyer. Si le numéro n'est pas compatible WhatsApp, le lien est copié pour être transmis autrement.

La file affiche ensuite l'état : « Lien envoyé · en attente du client », « Lien expiré · à relancer », « Confirmée par le client », « Annulée par le client » ou « Modification demandée : … ». Il ne reste à appeler que les clients sans réponse.

## Pour le client
Le lien ouvre `/vitrines/{boutique}/confirmer/{jeton}` (non indexée, en français ou en arabe) : articles, total à payer à la livraison, nom, gouvernorat et adresse. Trois choix :
- **Je confirme** → la commande passe à « Confirmée » ;
- **Je veux modifier** (message obligatoire) → « À rappeler » dans 30 minutes, avec le message dans l'historique ;
- **J'annule** → « Annulée », stock libéré.

Une seule réponse par lien. Un double clic n'enregistre qu'une réponse. Un lien expiré, ou une commande déjà traitée par la boutique, n'accepte plus de réponse.

## Pourquoi un lien distinct du lien de suivi
Le lien de suivi est montré dès la commande. Le lien de confirmation, lui, n'arrive que sur le téléphone de la commande : l'ouvrir montre que le client a accès à ce numéro.

## Technique
- Règles dans `applyAction` (`issueConfirmationLink`, `customerConfirmation`) et `modules/shops/order-confirmation.ts` ; la réponse réutilise la transition de statut existante (libération du stock comprise).
- Écriture publique dans `modules/shops/order-confirmation-service.ts` : verrou par marchand, contrôle de version et limitation à 20 tentatives par lien sur 10 minutes, comme les demandes d'annulation existantes.
- Préparation du lien côté équipe avec la permission `orders.update` (propriétaire, administrateur, responsable, agent du call center).
- Routes : `POST /api/v1/shops/{shopId}/confirmation-links`, `POST /api/v1/public/vitrines/{slug}/confirmer/{token}` ; page et réponse autorisées sur un domaine personnalisé (`/confirmer/{jeton}`).

## Vérifications
- Tests unitaires de la règle et des états, plus un test d'intégration PostgreSQL `tests/order-confirmation-api.test.ts` : agent, réutilisation du lien, autre boutique, double clic, réponse unique, historique.
- Recette dans Chromium sur un build de production local derrière un relais HTTPS : clic sur le bouton, message WhatsApp généré, badge « Lien envoyé », confirmation par le client sur mobile, commande sortie de la file ; page en arabe.

## Limites
L'envoi reste manuel (bouton WhatsApp), faute de prestataire. Pas de relance automatique des non-répondants. Boutiques historiques `/boutiques/…` non couvertes : leur parcours de commande est séparé.
