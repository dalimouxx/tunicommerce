# Étape 02 — limite maxShops sur toutes les organisations

La création de nouvelles boutiques via POST /api/v1/shops est soumise au nombre maximal de boutiques configuré dans SubscriptionPlan.maxShops du Workspace marchand. Les limites illimitées restent illimitées : aucune valeur commerciale n'est inventée. La vérification compte toutes les boutiques de toutes les organisations possédées par le marchand, quel que soit leur statut. Une boutique historique non liée occupe un emplacement ; après liaison à une Shop, elle n'est comptée qu'une fois.

Les créations concurrentes sont sérialisées par verrou advisory PostgreSQL transactionnel sur l'identifiant du propriétaire. La vérification reste dans la même transaction que la création.

Les restrictions agissent uniquement sur les nouvelles créations, sans supprimer, suspendre ou renommer aucune ancienne boutique. Une limite abaissée n'efface pas les boutiques existantes, mais bloque les suivantes. Les employés ne peuvent pas créer sous une organisation qu'ils ne possèdent pas.

Limites à traiter avant commercialisation : les plafonds maxMembers, expiration des abonnements, modifications admin des quotas, liaison du Workspace historique, et abonnement SaaS natif pour les marchands sans Workspace. Validation HTTP PostgreSQL et CI nécessaires avant déploiement.
