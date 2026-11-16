# Fiabilité des clients entre boutiques

Conception : [specs/2026-11-16-fiabilite-clients-design.md](superpowers/specs/2026-11-16-fiabilite-clients-design.md). Option A : information seulement, aucun blocage automatique.

## Ce que voit le marchand
Dans la file de confirmation du call center, sous le client de chaque commande : « Historique Tunicom : 12 livrées · 6 refusées (toutes boutiques) ». Le texte est rouge s'il y a au moins un refus, vert sinon, et absent si le numéro n'a aucune commande terminée sur Tunicom. Le marchand décide lui-même (appeler, demander un acompte, confirmer). Il ne voit que des compteurs, uniquement pour le numéro de ses propres commandes : jamais de nom de boutique, de produit, d'adresse ou de date.

## Ce qui est compté
- **Livrée** : commande au statut « Livrée ».
- **Refusée** : commande passée d'« Expédiée » à « Retournée ». Une annulation avant expédition n'est jamais comptée.
- Un refus contesté n'est plus compté pendant l'examen. Un refus retiré par le Super Admin ne compte plus jamais ; un refus maintenu compte de nouveau.

## Confidentialité
- Le numéro n'est jamais stocké en clair dans la table partagée `CustomerDeliveryOutcome` : on y trouve un HMAC-SHA256 du numéro normalisé, avec une clé dérivée de `APP_ENCRYPTION_SECRET`. Sans ce secret, la fonction est inactive et la page d'arbitrage l'indique.
- Une mention sous les trois formulaires de commande (produit, panier des vitrines, boutiques historiques), en français et en arabe, informe le client du partage sous forme de compteurs et de la possibilité de contester.

## Contestation
Le lien de suivi d'une commande retournée (vitrines) affiche « Colis enregistré comme refusé » et un formulaire « Contester ce refus » (motif de 10 caractères minimum, 10 envois au plus par lien sur 10 minutes). Le Super Admin tranche dans **Refus contestés** (`/admin/contestations`) : « Retirer le refus » ou « Maintenir le refus ». Chaque décision est inscrite au journal d'administration.

## Mise à jour des données
- Automatique dans la transaction des deux chemins d'écriture marchands : `writeIsolatedCommerce` pour les vitrines et `mutateLegacyCommerce` pour les boutiques historiques.
- **Au déploiement**, puis si besoin : `npm run reliability:rebuild` reconstruit tout l'historique à partir des commandes existantes, de façon idempotente et sans perdre les contestations. À lancer une fois après la migration `202611160001_customer_delivery_outcomes`.

## Point légal
Loi tunisienne 2004-63 sur la protection des données personnelles : faites valider ce partage par un juriste, et le déclarer à l'INPDP si nécessaire, avant de l'activer en production.

## Vérifications
- Tests unitaires : clé, définition du refus, comptage avec contestations, libellé, branchements.
- Test d'intégration PostgreSQL `tests/reliability-api.test.ts` : refus visible depuis une autre boutique, numéro jamais en clair, marchand d'une autre boutique refusé, contestation, décision, journal, reconstruction.
- Recette Chromium sur un build de production local derrière un relais HTTPS : compteurs dans la file, contestation par le client sur mobile, décision du Super Admin, statut affiché au client.

## Limites
La page de suivi des boutiques historiques ne propose pas encore la contestation, mais leurs refus sont comptés. Les écritures hors des deux chemins principaux (rares) ne sont reprises qu'à la prochaine reconstruction.
