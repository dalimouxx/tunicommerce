# Étape 02 — limites globales de collaborateurs par marchand

Les offres TuniCommerce disposent déjà de `SubscriptionPlan.maxMembers`, mais cette limite n'était pas appliquée à l'acceptation des invitations ni à la réactivation des employés. Cette PR applique le plafond sur les comptes **distincts, actifs et non propriétaires** ayant accès à une ou plusieurs boutiques de toutes les organisations du marchand.

- L'invitation n'est pas encore une place occupée : la place est vérifiée au moment de son acceptation. Si l'offre est complète, l'invitation reste valide jusqu'à son expiration ou sa révocation.
- Les réactivations sont également vérifiées, pour empêcher de contourner les quotas en alternant des accès actifs.
- Une personne active dans plusieurs boutiques du même propriétaire compte une seule fois.
- Le propriétaire d'une organisation ne consomme pas de place de collaborateur.
- La limite de plan `null` ou `0` conserve sa signification illimitée. Les comptes historiques `ADMIN` initialisés sans Workspace conservent leur parcours existant ; les marchands ordinaires doivent avoir un Workspace de facturation.
- Verrou PostgreSQL transactionnel `pg_advisory_xact_lock(hashtext(ownerId))` partagé par les opérations d'activation et les nouvelles créations de boutiques, empêchant de dépasser le plafond lors d'acceptations simultanées entre boutiques.
- Les anciens membres ne sont jamais supprimés ni désactivés automatiquement si l'administrateur réduit la limite. Seules les nouvelles activations sont bloquées.

**Restant :** pré-réservation et visibilité des places sur l'écran d'invitation ; fin de validité du forfait (trial, overdue, grace period), activation simultanée d'abonnements, contrôle de création de membre par d'autres éventuelles voies internes, et parcours commercial complet.

Tests : cas de dépassement, libération d'une place, réactivation refusée, double affectation à deux boutiques et non-consommation d'une seconde place.
