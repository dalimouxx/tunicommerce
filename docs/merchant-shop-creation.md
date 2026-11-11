# Création et préparation des boutiques indépendantes

Le marchand ouvre « Mes boutiques », puis « Créer une boutique ». La page privée `/mes-boutiques/nouvelle` propose un nom, un lien suggéré sans accents et un groupe de boutiques possédé par le compte. Un groupe peut être créé au même endroit. Les quotas du propriétaire comprennent ses brouillons et ses boutiques historiques ; la vérification transactionnelle du serveur reste déterminante en cas d'onglets simultanés.

La création utilise les API existantes. Elle crée un brouillon et un rôle OWNER pour le compte connecté, sans copier de catalogue ni publier de vitrine. Le nouveau propriétaire rejoint ensuite sa fiche, initialise son commerce vide, ajoute ses produits, choisit son thème et ouvre l'aperçu privé.

La checklist distingue les exigences réelles de publication — initialisation, produit actif, abonnement valide — des conseils de présentation de la marque. Elle utilise les mêmes règles que la publication serveur. Un produit actif épuisé n'est pas confondu avec un produit masqué : la boutique peut le présenter, mais le checkout contrôle toujours sa disponibilité. Les étapes s'actualisent sur demande ; la publication reste une action explicite.

Le répertoire affiche le bon lien public pour les boutiques indépendantes publiées et initialisées avec un abonnement actif, et un lien d'aperçu pour leur propriétaire. Un abonnement suspendu ou expiré masque le lien public et indique que la publication enregistrée n'est plus disponible. Les collaborateurs conservent leurs permissions et ne reçoivent pas les outils du propriétaire.

La création des groupes emploie maintenant le verrou du propriétaire : deux demandes simultanées ne dépassent pas la limite de dix groupes. La création des boutiques conserve son verrou et ses plafonds partagés entre organisations. La forme du contrat HTTP est conservée ; aucune migration ni dépendance ajoutée.

Vérifications : tests unitaires de suggestions de liens et d'exigences de publication ; parcours HTTP de création, initialisation, publication, suspension et répertoire ; refus d'une organisation étrangère ; limites concurrentes des boutiques et des groupes ; conservation des données historiques. La nouvelle route est couverte automatiquement par l'audit général des pages privées. Les suites sont exécutées uniquement sur une base de test jetable.

Ce lot ne connecte aucun prestataire. Les paiements en ligne, transporteurs, SMTP transactionnel et SMS/WhatsApp réels attendent leur choix et leurs tests d'intégration. La normalisation complète des données, le stockage objet et les domaines personnalisés restent des chantiers séparés.
