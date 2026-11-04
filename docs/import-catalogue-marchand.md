# Import catalogue · Boutiques indépendantes

Le propriétaire peut importer jusqu'à 100 références par fichier CSV, sans toucher au catalogue historique ni aux autres boutiques.

Format obligatoire : UTF-8 (avec ou sans BOM), séparateur point-virgule et en-têtes exacts :

```csv
sku;name;category;variant;priceTnd;costTnd;stock;threshold
TEE-RED;T-shirt;Mode;Rouge;35,500;17,000;12;3
PANT-BLU;Jean;Mode;Bleu;99,000;48,500;5;2
```

Les noms contenant un point-virgule doivent être placés entre guillemets. Les prix sont en dinars avec au plus 3 décimales. Les stocks et seuils sont des entiers positifs ou nuls.

Le serveur valide **à nouveau** toutes les lignes. Il refuse les SKU déjà présents (insensibles à la casse), les produits mal formés et les imports dépassant 100 références. Les nouveaux stocks sont enregistrés comme mouvements d'inventaire, et les quotas SaaS sont vérifiés globalement. Le verrou de transaction garantit que l'import échoue entièrement si une ligne ou le quota ne passent pas.

**Limites actuelles :** import création uniquement (pas de mise à jour ou suppression en masse), images, promotions et variantes complexes à traiter séparément. Surveiller les exports, la concurrence et les sauvegardes sur un environnement de test avant utilisation commerciale.
