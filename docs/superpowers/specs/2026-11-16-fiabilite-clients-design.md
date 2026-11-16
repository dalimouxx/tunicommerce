# Fiabilité des clients entre boutiques — conception

Date : 2026-11-16. Option A (information seulement) approuvée par le porteur du projet.

## Intention
Un client qui refuse ses colis chez plusieurs marchands reste aujourd'hui inconnu du marchand suivant. Chaque marchand doit voir, au moment de confirmer, l'historique de livraison **sur Tunicom** du numéro de téléphone de la commande, sous forme de compteurs, puis décider lui-même (appeler, demander un acompte…). Tunicom ne bloque rien.

## Approches
- **A. Information seulement** (retenue) : compteurs affichés, aucune action automatique.
- B. Action automatique au-delà d'un seuil : écartée par le porteur (risque d'erreur pour le client, risque juridique accru).

## Données et confidentialité
- Table `CustomerDeliveryOutcome` (migration additive) : une ligne par commande terminée — `phoneKey`, `shopId`, `orderId`, `outcome` (`DELIVERED` | `REFUSED`), `occurredAt`, et les champs de contestation.
- **Le numéro n'est jamais stocké en clair** dans cette table : `phoneKey` = HMAC-SHA256 du numéro normalisé (8 chiffres), avec une clé dérivée de `APP_ENCRYPTION_SECRET`. Un simple condensat serait réversible : il n'y a que 10⁸ numéros possibles. Sans secret configuré, la fonction reste inactive et l'écran l'indique.
- **Refus** = commande passée de « Expédiée » à « Retournée » (seule transition possible vers `RETURNED`). Une annulation avant expédition n'est jamais un refus. **Livrée** = `DELIVERED`.
- **Partagé entre boutiques** : uniquement deux compteurs (livrées, refusées) pour le numéro de la commande. Jamais de nom de boutique, de produit, d'adresse ou de date précise.

## Mise à jour
- Dans la transaction des deux chemins d'écriture marchands (`writeIsolatedCommerce`, `mutateLegacyCommerce`) : les commandes terminées de la boutique sont rapprochées de la table (ajout, changement, suppression).
- Commande `npm run reliability:rebuild` : reconstruction complète, idempotente, pour le rattrapage de l'existant et les rares écritures hors de ces chemins. Elle préserve les contestations.

## Affichage marchand
File de confirmation et commandes : « Historique Tunicom : 6 livrées · 2 refusées (toutes boutiques) », affiché seulement s'il existe au moins une commande terminée. Accès avec la permission `orders.read`, uniquement pour les commandes de sa boutique (le marchand ne peut pas interroger un numéro quelconque).

## Transparence et contestation
- Mention sous les formulaires de commande, en français et en arabe : les livraisons réussies ou refusées du numéro peuvent être partagées sous forme de compteurs entre les boutiques Tunicom, et un refus peut être contesté depuis le lien de suivi.
- Le lien de suivi d'une commande « Retournée » propose « Contester ce refus » (motif obligatoire). La contestation retire le refus des compteurs en attendant la décision.
- Super Admin, `/admin/contestations` : « Refus confirmé » (le refus est recompté) ou « Refus retiré » (il n'est plus jamais compté). Chaque décision est inscrite au journal.

## Point légal (hors code)
Loi tunisienne 2004-63 sur la protection des données personnelles : le partage entre marchands est un traitement à faire valider par un juriste, et probablement à déclarer à l'INPDP, avant la mise en production.

## Hors périmètre
Blocage ou acompte automatique ; contestation depuis le suivi des boutiques historiques (leurs refus sont comptés, mais leur page de suivi ne propose pas encore la contestation) ; score sous forme de note ou de lettre.

## Calls du constructeur
HMAC avec une clé dérivée de `APP_ENCRYPTION_SECRET` ; compteurs bruts, sans pourcentage ni note ; une contestation par commande ; rattrapage par une commande manuelle (pas de tâche planifiée dans ce lot).
