# Compactage des commandes terminées — conception

Date : 2026-11-16. Étape 2 du chantier « vraies tables », voie 1 (compactage) approuvée par le porteur du projet.

## Intention
Les commandes représentent 57 % du bloc JSON réécrit à chaque action. Une commande terminée depuis longtemps garde des détails qui ne servent plus qu'à l'affichage détaillé. On les déplace dans une table d'archive, sans perte, et la commande garde dans le bloc tout ce que les calculs utilisent.

## Approches
- **Compactage** (retenu) : aucun des 70 fichiers lecteurs n'est modifié et les totaux restent identiques.
- Retrait complet des anciennes commandes : écarté pour l'instant (réécriture SQL de tous les calculs, plusieurs semaines, risque financier).

## Ce qui est retiré du bloc (et archivé)
Après vérification de chaque lecteur :
- **Historique des événements** : on garde le dernier événement et le dernier événement du statut final. La fiabilité y lit la date de livraison ou de refus.
- **Signaux de risque** : affichés seulement pour les commandes en cours.
- **Confirmation client** : utile uniquement avant la confirmation.

**Conservés** : la copie du client (19 lecteurs, dont la ville pour les statistiques transporteurs, et le nom et le téléphone pour la recherche et la fiabilité), les articles et leurs coûts, les montants, l'encaissement, le transporteur, le suivi, les notes, les demandes client, les dates et le lien de suivi.

Gain mesuré sur 1 000 commandes : **1,29 → 0,93 Mo (−28 %)**, soit 1 181 → 825 octets par commande terminée.

## Éligibilité
Statut `DELIVERED`, `CANCELLED` ou `RETURNED`, dernière mise à jour il y a plus de **90 jours**, aucune demande client en attente, aucune facture en brouillon, aucun retour dont le remboursement est incomplet. Une commande déjà compactée qui reçoit plus tard un nouvel événement est recompactée, et son archive est complétée.

## Fonctionnement
- Table `CommerceOrderArchive` (source × commande) : événements complets (union, sans doublon), signaux, confirmation, date de compactage.
- Le compactage s'exécute dans `offloadHistory`, déjà appelé par les sept chemins d'enregistrement : au plus **50 commandes par écriture**, pour ne jamais alourdir une action.
- Les chemins d'enregistrement transmettent l'état **réellement enregistré** (compacté) aux synchronisations suivantes : copie de recherche, catalogue, e-mails, webhooks, fiabilité. La copie de recherche reste ainsi identique au bloc.
- `npm run history:offload` compacte toutes les boutiques existantes (idempotent).
- L'historique complet des événements archivés reste exportable en CSV par le propriétaire (`kind=events`).

## Vérification attendue
Test « avant / après » : sur une boutique avec des commandes anciennes, tous les calculs (vue commerciale, rentabilité par produit, annuaire clients, rapprochement du paiement à la livraison, relevés transporteurs, anomalies, quotas, fiabilité, copie de recherche) donnent exactement les mêmes résultats avant et après compactage.

## Hors périmètre
Retrait complet des commandes du bloc ; affichage des événements archivés dans la fiche commande (l'export CSV suffit pour l'instant).
