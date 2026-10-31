# Vérifications — 30 octobre 2026

## Réussies localement
- TypeScript sans erreur.
- Build Next.js 16.3.4 / Prisma 6.19.0 réussi sur Node.js 24.
- 33 tests métier/SQL local issus de l’application existante.
- 6 tests de sécurité supplémentaires : scrypt, sessions, origine, taille en octets, JSON, validation propriétaire.
- Démarrage du serveur de production.
- Contrôles HTTP : login et setup 200 ; accueil anonyme 307 ; deux routes commerce 401 malgré de faux en-têtes ChatGPT ; mutation d’origine étrangère 403.
- En l’absence de base configurée, health répond 503 comme prévu.
- render.yaml conforme au schéma JSON officiel Render (JSON Schema 2020-12).

## Préparées, non exécutées
8 scénarios d’intégration PostgreSQL et HTTP dans tests/postgres.test.ts, à lancer via GitHub Actions. Le moteur PostgreSQL natif n’a pas pu être lancé ici : l’environnement ne permet pas le changement d’utilisateur nécessaire. Les 39 tests réussis ne prouvent pas encore le fonctionnement avec PostgreSQL distant. Les anciens tests de handlers avec adaptateur D1 ont été remplacés par cette suite d’intégration ; ils ne sont pas comptés parmi les tests de la nouvelle architecture.

## Restant à vérifier
Création du dépôt, exécution CI, validation Render CLI/API, migrations sur Render, déploiement, setup propriétaire et parcours métier avec la session réelle. Aucun test de charge, audit de sécurité externe, sauvegarde/restauration réelle ou validation fiscale. Aucun test navigateur visuel de la nouvelle page de connexion.

## 0.5 — vérifications ajoutées

Tests HTTP PostgreSQL : droits du superadministrateur, refus d’un marchand sur l’API admin, séparation des données, création d’une boutique vide, absence de coordonnées privées dans le HTML public, commande anonyme et double envoi concurrent, recalcul du prix, stock décrémenté une seule fois, produits d’une autre boutique refusés, suspension/expiration/dépublication vérifiées côté serveur, origine externe refusée et journal d’administration.
