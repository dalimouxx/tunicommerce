# Alertes e-mail de commande au propriétaire

Le parcours privé `/mes-boutiques/<shopId>/notifications` prépare les alertes de nouvelles commandes et de changement de statut. Il fonctionne pour les commerces indépendants et les boutiques historiques liées à un Workspace, en conservant leurs commandes et leur adresse publique. Le tableau de la boutique contient le lien « Gérer mes alertes e-mail ».

## Activation volontaire

Les alertes sont désactivées par défaut. Le véritable propriétaire doit disposer d'une adhésion OWNER active, de son adresse e-mail vérifiée et d'une configuration SMTP complète avec chiffrement. Un rôle ADMIN de boutique, une fausse adhésion OWNER sur l'organisation d'un autre utilisateur ou une session d'administration globale ne donne pas accès aux réglages. Les modèles peuvent être préparés avant configuration du SMTP ; aucun bouton n'envoie d'e-mail de test. Aucun service d'envoi réel n'est activé par la livraison.

Le destinataire est exclusivement l'adresse vérifiée du compte propriétaire. Le navigateur ne peut pas définir un destinataire différent. Cette fonction est une alerte opérationnelle au marchand ; elle n'est pas un envoi automatique aux acheteurs, une campagne marketing, un SMS ou une intégration WhatsApp.

## Modèles et contenu

Chaque type d'événement possède son objet et son texte simple, modifiables en français ou en arabe, avec direction de texte automatique et aperçu fictif. Les variables autorisées sont `{boutique}`, `{reference}`, `{statut}`, `{total}`, `{lien}` et `{date}`. Le montant inclut le total enregistré de la commande, exprimé avec trois décimales TND ; la date d'événement est en UTC ISO 8601. Le lien conduit à l'espace privé de la boutique et exige une connexion.

Les coordonnées clients, noms, adresses, notes, coûts internes et liens confidentiels de suivi ne sont pas insérés. Les modèles ne contiennent pas de HTML exécutable ; les objets avec retour à la ligne ou les variables inconnues sont refusés. Les modèles sont limités à 160 caractères pour l'objet, 4 000 pour le texte avant substitution ; le texte rendu est limité à 12 000 caractères afin de borner le contenu chiffré. Les substitutions répétées ne sont pas réinterprétées.

Les réglages utilisent une version attendue. Une écriture concurrente retourne 409 et conserve le brouillon dans l'écran. Actualiser les tentatives ne met pas silencieusement la version du brouillon à jour : si des réglages différents sont détectés, l'utilisateur peut les comparer puis remplacer explicitement son brouillon. Un timeout ne constitue pas une confirmation de sauvegarde.

## File transactionnelle et tentatives

La création de la commande ou la transition réussie insère une tâche ORDER_EMAIL dans la même transaction PostgreSQL. Les chemins marchands historiques et indépendants ainsi que leurs deux checkouts publics utilisent le même mécanisme. Un rollback ne laisse pas de tâche orpheline ; les clés de déduplication associent boutique, commande, version commerciale et événement. Un retry du même checkout ou de la même action n'ajoute pas d'alerte. Une note modifiée seule ne déclenche pas d'alerte.

Le contenu est chiffré. Si une configuration précédemment active perd sa clé de chiffrement, la commande reste enregistrable : une tâche terminale CONFIGURATION_MISSING sans contenu est créée. Un compte non vérifié ou un propriétaire révoqué n'ajoute pas de message. Les réglages invalides sont également signalés sans bloquer le commerce.

Le worker recontrôle l'activation, l'identité et l'adhésion du propriétaire, l'adresse vérifiée inchangée, le rattachement historique éventuel et l'âge du message avant chaque tentative. Au-delà de 48 heures, le message expire sans envoi. Désactiver les alertes annule les tâches encore en attente et efface leur contenu. Un envoi déjà commencé peut néanmoins aboutir. Les statuts antérieurs restent des événements datés ; l'e-mail ne constitue pas une lecture instantanée du statut actuel.

Les délais, reprises bornées et baux sont ceux du worker de sécurité. La livraison reste au moins une fois : après acceptation SMTP suivie d'un crash, une reprise peut produire un doublon. L'identifiant Message-ID est stable. « Accepté par SMTP » ne signifie pas « reçu par le destinataire » et n'est pas un accusé de lecture.

Le journal privé montre les trente dernières tâches de cette boutique, leurs tentatives et diagnostics limités, jamais le contenu ou les paramètres SMTP. Le contenu est supprimé à l'état terminal ; les métadonnées expirent après trente jours selon `worker-operations.md`. Le SMTP, le worker hébergé et la délivrabilité réelle doivent encore être configurés et testés explicitement.
