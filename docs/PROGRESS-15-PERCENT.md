# Jalon demandé : environ 15 % restants

Demande du 13 novembre 2026. Le dernier état estimait environ 25 % de périmètre restant, avec une incertitude d’environ dix points. Il n’existe pas de décompte pondéré validé permettant de mesurer précisément ce pourcentage. Le jalon ne sera pas déclaré atteint sur la seule base d’un nombre de tests, de lignes de code ou de propositions.

Les lots sont enchaînés avec leurs preuves, sans arrêt après chaque proposition. Le développement et les activations externes sont suivis séparément : aucun prestataire n’est choisi, aucun VPS réel ni domaine n’est encore configuré pour ce chantier.

| Lot | Critère de livraison | État initial |
| --- | --- | --- |
| Exploitation VPS | Images, services isolés, migrations, démarrage et arrêt du worker, proxy, persistance et exercice de restauration dans des conteneurs jetables | PR 145 fusionnée après deux workflows réussis, dont quinze contrôles conteneurs réels ; installation sur VPS réel non effectuée |
| Médias durables | Nettoyage borné des copies sans référence, protection des fichiers actifs, diagnostic, vérification de récupération depuis PostgreSQL | PR 146 fusionnée : 685 tests applicatifs et seize contrôles conteneurs réussis ; nettoyage réel désactivé par défaut |
| Domaines | Revérification des preuves DNS, comportement sûr en panne et refus des liaisons devenues invalides, tests HTTP/DNS | PR 147 fusionnée : 698 tests applicatifs et dix-sept contrôles conteneurs réussis ; routage réel désactivé sur Render |
| Données métier | Poursuite des lectures structurées et paginées avec contrôle de parité, isolation et transition compatible pour les boutiques existantes | Recherche privée des commandes et clients ajoutée, avec copie structurée, reprise compatible et maintien transactionnel ; les JSON restent la référence des écritures |
| Recette et livraison | Régressions pertinentes, vérification du code exact fusionné, déploiement Render et tests en ligne du comportement livré | À répéter pour chaque lot pertinent |

Restent distincts : choix et comptes des prestataires, débits SaaS réellement automatiques, livraison/paiement/SMS/WhatsApp en conditions réelles, installation et recette sur le VPS cible, DNS/HTTPS réels, sauvegardes hors site actives et restauration réelle, normalisation complète des écritures et réduction des octets médias en base. Ces éléments ne sont pas assimilés à du travail terminé par l’ajout d’une configuration ou d’un adaptateur simulé.

L’estimation sera réévaluée après les preuves des lots, en mentionnant les limites et les travaux découverts. Si ces lots ne suffisent pas à justifier environ 15 % restants, le travail continue ou la dépendance concrète est signalée ; le chiffre n’est pas ajusté pour annoncer artificiellement l’objectif atteint.
