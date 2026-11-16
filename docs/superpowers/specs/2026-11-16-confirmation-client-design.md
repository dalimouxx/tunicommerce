# Confirmation des commandes par le client — conception

Date : 2026-11-16. Le porteur du projet a choisi de réduire d'abord le temps d'appel ; le score de fiabilité entre boutiques suivra.

## Intention
Aujourd'hui, chaque commande en paiement à la livraison demande un appel ou un échange WhatsApp, puis un changement de statut à la main. Le client doit pouvoir confirmer lui-même, en un clic, depuis un lien reçu sur **son** téléphone. Le marchand n'appelle plus que ceux qui n'ont pas répondu.

## Pourquoi un lien distinct du lien de suivi
Le lien de suivi est affiché dès la fin de la commande : il ne prouve pas que le numéro saisi appartient bien au client. Le lien de confirmation est envoyé par le marchand **au numéro de la commande**, par WhatsApp. Ouvrir ce lien montre que le client a accès à ce numéro.

## Approches
- **Lien personnel envoyé par WhatsApp en un clic** (retenue) : gratuit, utilisable dès aujourd'hui avec le WhatsApp du marchand. Quand un prestataire SMS ou WhatsApp sera choisi, le même lien partira automatiquement.
- Envoi automatique immédiat par prestataire : bloqué tant qu'aucun prestataire n'est choisi ni financé.
- Bouton « Je confirme » sur la page de remerciement : écarté, il ne prouve pas l'accès au numéro.

## Fonctionnement
- **Marchand** : sur une commande « À confirmer », « Pas de réponse » ou « À rappeler », le bouton « Demander la confirmation (WhatsApp) » crée un lien personnel (jeton aléatoire, valable 7 jours ; réutilisé s'il est encore valable) et ouvre WhatsApp avec un message pré-rempli : récapitulatif (référence, articles, total, ville) et lien. L'historique de la commande indique « Lien de confirmation préparé ».
- **Client** : `/vitrines/{boutique}/confirmer/{jeton}` (non indexée) affiche la commande (articles, total, nom, gouvernorat, adresse) et trois choix :
  - **Je confirme** → statut « Confirmée » ;
  - **Je veux modifier** (message obligatoire : adresse, quantité, horaire…) → statut « À rappeler », avec le message dans l'historique ;
  - **J'annule** → statut « Annulée », stock libéré par la même transition que côté marchand.
- **Une seule réponse** par lien ; ensuite la page affiche la réponse donnée. Un lien expiré, ou une commande déjà traitée par le marchand, n'accepte plus de réponse.
- **Écriture sûre** : même mécanisme que les demandes d'annulation existantes (verrou par marchand, contrôle de version, limitation des tentatives, clé de requête idempotente).
- **Suivi** : la file de confirmation montre « Lien envoyé », « Confirmée par le client » ou « Modification demandée ». Chaque réponse est inscrite dans l'historique de la commande avec la mention « via le lien client ».
- Arabe et français ; fonctionne aussi sur un domaine personnalisé.

## Hors périmètre
Envoi automatique par prestataire, relance automatique des non-répondants, boutiques historiques `/boutiques/…` (leur parcours de commande est séparé).
