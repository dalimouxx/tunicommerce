# Jalon de développement demandé : environ 20 % restants

Point de départ au 12 novembre 2026 : l'estimation précédente était d'environ 30 % restants, avec une incertitude d'environ dix points. Aucun décompte pondéré validé n'existait. Le nombre de tests ou de propositions fusionnées ne permet pas de calculer un pourcentage d'achèvement.

Le suivi ci-dessous distingue le développement vérifié de l'exploitation à configurer. Le jalon n'est pas déclaré atteint par la seule rédaction de ce document. Les lots se poursuivent sans demander une nouvelle autorisation à chaque proposition.

| Chantier suivant | Preuve nécessaire | État au début du jalon |
| --- | --- | --- |
| Exploitation des traitements | Présence du worker, diagnostic privé, purge bornée et concurrente, sonde VPS, tests et déploiement | Livré par la PR 139, quinze workflows réussis, Render Live le 12 novembre ; worker et alertes externes non activés |
| Communications de commande | Préférences explicites, modèles, file transactionnelle, isolation, suivi des tentatives ; aucun envoi réel sans configuration | Alertes au propriétaire livrées par la PR 140, 22 workflows réussis, Render Live et 86 contrôles publics ; communications automatiques aux acheteurs toujours à développer |
| Intégrations métier | Événements durables, authentification des échanges, déduplication, reprises bornées, paramètres privés | À développer selon le périmètre indépendant des prestataires |
| Données et médias | Migration additive, conservation des boutiques existantes, contrôle de parité et stockage configurable | Catalogue paginé et première copie relationnelle des produits livrés par la PR 141 ; 623 contrôles locaux, 22 workflows GitHub, Render Live et 88 contrôles publics ; migration complète et stockage de fichiers distincts restent à développer |

Les tâches restantes au-delà de ces lots comprennent les connexions réelles aux transporteurs, paiements et SMS/WhatsApp, la récurrence SaaS selon le prestataire choisi, la recette SMTP, l'activation des domaines et du HTTPS sur VPS, la restauration de sauvegardes réelles, la supervision externe et les validations légales/commerciales. Les fonctions avancées du builder et la normalisation complète des données demandent aussi un suivi distinct. Ces prérequis ne peuvent pas être déclarés terminés sans preuve.

À chaque livraison, mettre à jour les preuves et réévaluer le reste à faire. Un nouveau pourcentage restera une estimation de périmètre, et ne constituera pas une autorisation de lancement commercial.

Après les PR 139 à 141, les trois lots opérationnels livrés ramènent l'estimation autour de 25 % restants, toujours avec une incertitude d'environ dix points. Les échanges métier signés et la préparation d'exploitation VPS constituent les prochains lots du jalon ; ils ne remplacent pas les connexions réelles aux prestataires.

## Priorités confirmées par le propriétaire

1. Abonnements SaaS automatiques : préparer les rappels et le cycle d’échéance ; les débits nécessitent un prestataire et sa recette.
2. Données et médias : poursuivre la migration additive et préparer un stockage externe réversible.
3. Domaines, HTTPS et sauvegardes réelles : préparer l’exploitation, puis activer avec les accès VPS/DNS et la destination de sauvegarde.
4. Bugs et recette complète : vérifier les parcours réels et conserver un registre des anomalies corrigées et encore ouvertes.
5. Connexions livraison, paiement, e-mails et SMS/WhatsApp : choisir les services, développer et tester les adaptateurs, puis activer explicitement.

Les événements métier signés sont fusionnés par la PR 142 après 26 workflows réussis. Les rappels d’abonnement font l’objet du lot suivant ; ils ne rendent pas les paiements automatiques opérationnels. Aucun nouveau pourcentage n’est déduit du seul ajout de ces rappels.

Au 13 novembre, les rappels d’abonnement de la PR 143 sont déjà livrés sur Render depuis le 12 novembre, avec 657 tests locaux et quinze workflows réussis. Le lot médias suivant prépare un miroir privé sur VPS, une copie et une vérification par lots, et un repli PostgreSQL. Il conserve volontairement tous les originaux en base et ne constitue ni une activation de disque sur Render ni une migration complète des données métier. La réduction de taille en base reste conditionnée à une restauration vérifiée et à une étape ultérieure.
