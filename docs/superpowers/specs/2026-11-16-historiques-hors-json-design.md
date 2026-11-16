# Journal et mouvements de stock hors du bloc JSON — conception

Date : 2026-11-16. Étape 1 du chantier « vraies tables », approuvée par le porteur du projet.

## Intention
Chaque action d'un marchand réécrit tout le bloc JSON de sa boutique. Dans une simulation de 1 000 commandes, le journal d'activité représente 31 % de ce bloc et les mouvements de stock 9 %. Ces deux historiques ne font que grossir. On les déplace vers de vraies tables, et le bloc n'en garde qu'une fenêtre récente.

## Approches
- **Fenêtre récente dans le JSON et historique complet en tables** (retenue) : les écrans existants continuent de lire le JSON, sans changement de logique.
- Tout lire depuis les tables : écarté pour cette étape (il faudrait modifier tous les écrans).
- Archiver d'abord les commandes : reporté à l'étape 2 (70 fichiers les lisent).

## Règles
- Tables `CommerceJournalEntry` et `CommerceStockMovement`, identifiées par la source (`SHOP` + `shopId`, ou `WORKSPACE` + `workspaceId`) et l'identifiant d'origine de l'entrée (unicité source × entrée).
- Dans chaque chemin qui enregistre le bloc JSON, juste avant l'enregistrement et dans la même transaction : toutes les entrées présentes (fenêtre et nouvelles) sont insérées avec `skipDuplicates`, puis le bloc garde les **200** plus récentes de chaque historique. Insérer la fenêtre entière, et pas seulement les nouveautés, rattrape aussi les entrées ajoutées par d'éventuels autres chemins.
- Aucune valeur métier ne change : le stock vit sur le produit ; les écrans affichent déjà au plus 100 lignes du journal et 30 mouvements.
- Historique complet : export CSV par le propriétaire de la boutique (`GET /api/v1/shops/{shopId}/history?kind=journal|movements`).
- Rattrapage : `npm run history:offload` copie les historiques existants et allège les blocs. Idempotent, il prend le même verrou et contrôle la même version que les écritures.

## Vérifications attendues
Aucune perte (chaque entrée retirée du JSON est présente en table) ; idempotence ; le bloc ne dépasse jamais la fenêtre après une écriture ; montants, stock et commandes inchangés.

## Hors périmètre
Archivage des commandes (étape 2) ; lecture paginée de l'historique dans les écrans (l'export CSV suffit pour cette étape).
