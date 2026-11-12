# Jalon de développement demandé : environ 20 % restants

Point de départ au 12 novembre 2026 : l'estimation précédente était d'environ 30 % restants, avec une incertitude d'environ dix points. Aucun décompte pondéré validé n'existait. Le nombre de tests ou de propositions fusionnées ne permet pas de calculer un pourcentage d'achèvement.

Le suivi ci-dessous distingue le développement vérifié de l'exploitation à configurer. Le jalon n'est pas déclaré atteint par la seule rédaction de ce document. Les lots se poursuivent sans demander une nouvelle autorisation à chaque proposition.

| Chantier suivant | Preuve nécessaire | État au début du jalon |
| --- | --- | --- |
| Exploitation des traitements | Présence du worker, diagnostic privé, purge bornée et concurrente, sonde VPS, tests et déploiement | Code et tests ciblés réalisés ; validation complète et livraison en cours |
| Communications de commande | Préférences explicites, modèles, file transactionnelle, isolation, suivi des tentatives ; aucun envoi réel sans configuration | À développer |
| Intégrations métier | Événements durables, authentification des échanges, déduplication, reprises bornées, paramètres privés | À développer selon le périmètre indépendant des prestataires |
| Données et médias | Migration additive, conservation des boutiques existantes, contrôle de parité et stockage configurable | À développer progressivement |

Les tâches restantes au-delà de ces lots comprennent les connexions réelles aux transporteurs, paiements et SMS/WhatsApp, la récurrence SaaS selon le prestataire choisi, la recette SMTP, l'activation des domaines et du HTTPS sur VPS, la restauration de sauvegardes réelles, la supervision externe et les validations légales/commerciales. Les fonctions avancées du builder et la normalisation complète des données demandent aussi un suivi distinct. Ces prérequis ne peuvent pas être déclarés terminés sans preuve.

À chaque livraison, mettre à jour les preuves et réévaluer le reste à faire. Un nouveau pourcentage restera une estimation de périmètre, et ne constituera pas une autorisation de lancement commercial.
