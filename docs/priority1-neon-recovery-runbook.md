# TuniCommerce — Priorité 1 : sauvegarde et reprise après incident

## État vérifié (2026-11-04)

- Projet Neon : `tiny-resonance-64096818`, branche utilisée : `br-aged-dream-ba2vrcvl`.
- Plan Neon : `free_v3`; **10/10 branches utilisées**. Toutes les autres branches existantes ont des noms de sauvegarde ou de contrôle de migration.
- Snapshots : un snapshot manuel `snap-fragrant-art-ba9ykzyj` du 3 novembre 2026.
- Sauvegardes récurrentes : calendrier retourné **vide**.
- Fenêtre PITR retournée par Neon : **21 600 secondes (6 heures)**, insuffisante pour remplacer une sauvegarde quotidienne.
- La création d'un nouveau snapshot avait renvoyé `snapshots limit exceeded` lors d'une précédente vérification.
- Un comptage SQL sans modification sur la branche active a retrouvé 21 tables publiques, 2 boutiques, 2 memberships et 0 ShopCommerce initialisées au moment du contrôle. Cela ne valide **pas** une restauration de Neon.

### Mesures prises sans risque

Le workflow `priority1-backup-restore-drill.yml` crée une base PostgreSQL **jetable** avec des données factices, exécute les migrations Prisma, sauvegarde la base avec `pg_dump`, la restaure dans une deuxième base `*_test`, vérifie la présence de liens organisation/boutique/membre, la commande COD et les quantités. Il modifie la copie restaurée et prouve que la source reste intacte. Le dump reste uniquement sur l'agent GitHub et est détruit, jamais publié comme artifact.

**Cela valide un runbook de restauration PostgreSQL, pas encore la restauration d'un snapshot Neon de production.**

### Porte bloquante pour la sauvegarde Neon effective

Avant de déclarer la sauvegarde automatique fonctionnelle, le propriétaire doit choisir l'une de ces deux solutions :

1. **Neon payant**, avec une fréquence de snapshots, une politique de rétention et la possibilité de créer une branche temporaire de restauration.
2. **Sauvegarde chiffrée externe** à Neon, via `pg_dump` et stockage privé chiffré, avec rotation de clés, stockage séparé, supervision et restauration régulière. Ne jamais enregistrer les dumps dans les artifacts publics GitHub.

Le plan Free actuel est saturé de branches. **Ne supprimer aucune branche ou snapshot existant sans vérifier son utilité et obtenir l'accord explicite du propriétaire.** Ne pas exécuter un restore sur la branche principale.

### Protocole de restauration de la vraie base

1. Identifier l'incident, activer le mode maintenance Render si l'intégrité des écritures est menacée, consigner l'heure.
2. Avant toute modification : vérifier sauvegardes disponibles, fenêtre PITR, accès Neon, contrats et coûts.
3. Préparer une **nouvelle branche isolée** restaurée depuis le snapshot choisi (pas la branche active). Une place libre est requise ; ne pas recycler les anciennes sauvegardes automatiquement.
4. Inspecter schéma/migrations, relations entre utilisateurs/organisations/boutiques et données de `ShopCommerce`, sans exporter de PII dans les logs.
5. Comparer les stocks, commandes, versements et journaux. Tester les opérations avec des données factices sur la branche de récupération.
6. Faire confirmer le point de récupération et la perte potentielle de transactions postérieures (RPO).
7. Procéder à un basculement de service contrôlé **uniquement après approbation**, avec retour arrière documenté, puis tester la connexion et les transactions.
8. Retirer le mode maintenance après validation métier et revue de logs. Programmer la prochaine restauration d'essai sur un environnement séparé.

**Objectifs suggérés, pas garanties actuelles :** RPO ≤ 24 h, RTO ≤ 4 h pour le pilote, sous réserve de ressources, de données sauvegardées et de tests réellement exécutés.
