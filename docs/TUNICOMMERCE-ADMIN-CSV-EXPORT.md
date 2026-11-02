# Export comptable des règlements SaaS

Nouvelle route : `GET /api/admin/subscription-payments/export`.

L'export est réservé aux utilisateurs connectés avec le rôle global ADMIN. Il renvoie un CSV UTF-8 (avec BOM pour les tableurs), sans données des commandes, adresses ou numéros de téléphone des clients des boutiques.

Exemples :
- `/api/admin/subscription-payments/export` — toutes les déclarations.
- `/api/admin/subscription-payments/export?status=PENDING` — déclarations à vérifier.
- `/api/admin/subscription-payments/export?status=APPROVED` — déclarations approuvées.
- `/api/admin/subscription-payments/export?status=REJECTED` — déclarations refusées.

La limite est volontairement fixée à **5 000 dossiers** : au-delà, l'API refuse de générer un fichier incomplet. Pour de gros volumes, implémenter un export paginé ou un rapport asynchrone avec audit.

Les montants sont exprimés en TND, à 3 décimales. Les dates sont en UTC, selon le format ISO 8601. Les champs contrôlés par le marchand sont protégés contre les formules CSV (Excel/LibreOffice). Les données ne sont pas mises en cache.

**Important :** les déclarations `APPROVED` ne constituent pas à elles seules un rapprochement bancaire, et l'export n'est pas une facture fiscale. Il faut comparer les transactions avec les relevés réels.

Validation à exécuter avant fusion : `node --import tsx --test tests/billing-csv-export.test.ts`, `npm run typecheck`, `npm run build`, tests de connexion ADMIN et refus de l'accès MERCHANT/non connecté. Aucune migration de base de données.
