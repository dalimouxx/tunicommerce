# TuniCommerce — Déclarations de règlement SaaS et validation humaine (pilote)

## Nouveaux parcours

**Marchand :** `/mon-abonnement`.
- Le catalogue ne propose que les offres activées avec un prix > 0 millimes.
- Le marchand sélectionne une offre et signale une transaction **déjà effectuée en dehors de TuniCommerce** : D17, virement bancaire ou espèces.
- Pour D17/virement, une référence de transfert (min. 6 caractères) est requise.
- La déclaration crée un dossier `PENDING`. Elle **ne modifie ni le plan ni la date de fin d'abonnement**.
- Les demandes récentes sont affichées dans l'historique ; un document imprimable est accessible à `/mon-abonnement/justificatif/{id}`, uniquement pour la boutique propriétaire.

**Super-administrateur :** `/admin/paiements`.
- Liste limitée aux 200 dossiers les plus récents, recherche, filtrage par état.
- Vérifier manuellement montant + référence sur une **source extérieure fiable** (relevé D17, RIB bancaire officiel, reçu d'espèces).
- Cliquer sur « Valider le paiement » après confirmation ; une fenêtre demande confirmation explicite.
- Une validation approuvée : enregistre le statut `APPROVED`, date de vérification, admin, période créditée, audit de paiement, change le plan du Workspace et prolonge `subscriptionEndsAt` en statut `ACTIVE`.
- Un refus requiert un motif et laisse l'abonnement inchangé. Le marchand peut ensuite déposer une nouvelle demande.

## Intégrité et anti-fraude

- **Le navigateur ou la déclaration du marchand ne déclenchent aucune transaction bancaire.** Aucun secret D17/RIB n'est contenu dans le code ni dans l'interface.
- Tous les endpoints utilisent des sessions côté serveur et la vérification de même origine ; actions ADMIN uniquement pour valider/refuser.
- L'accès à l'historique et au justificatif marchand est restreint à son propre Workspace (le super-admin ne peut pas accéder à d'autres boutiques via ces URLs).
- Les offres sont tarifées en millimes (1 TND = 1000 millimes) ; le prix, le nom et la durée sont **figés lors de la déclaration**, même si le super-admin modifie ensuite la grille tarifaire.
- Une seule demande `PENDING` par boutique est permise par index unique partiel en PostgreSQL, même en cas de requêtes concurrentes.
- Chaque déclaration possède un identifiant idempotent `requestId` unique par Workspace ; rejouer la même demande renvoie le dossier existant, sans renouvellement supplémentaire.
- Le traitement administratif verrouille le Workspace dans la transaction PostgreSQL, recontrôle l'état `PENDING` et ne crédite la boutique **qu'une seule fois**.
- Les références des virements D17/bancaires **déjà approuvées** ne peuvent pas être utilisées pour créditer un deuxième dossier : index unique partiel sur (méthode, référence) avec statut `APPROVED`.
- Durée créditée : à partir du plus tardif entre **maintenant** et l'échéance enregistrée du Workspace. Pas de destruction des jours restants.
- Les refus et approbations produisent un événement `PlatformAudit` lié au Workspace et à l'administrateur.
- L'activation de l'abonnement n'altère pas le JSON commercial des produits, stocks, clients, commandes ni les encaissements COD.

## Documents et légalité

Le document imprimable est **une déclaration de règlement ou une attestation administrative de validation, et non une facture fiscale**. Il affiche le numéro de dossier, les données du propriétaire, la référence de transfert déclarée, l'offre et le montant enregistré, le résultat de la vérification et la période créditée.

Pour une **vraie facture fiscale tunisienne**, il faudra définir l'entité émettrice, ses coordonnées légales et fiscales, sa politique de TVA, sa séquence légale de factures et sa numérotation non réutilisable. Il faudra valider les mentions obligatoires avec le comptable. N'afficher aucun numéro fiscal ou RIB inventé.

## Limites connues

- L'application **ne connaît pas encore les coordonnées de réception** D17, RIB ou caisse ; l'opérateur doit les communiquer par canal officiel et les configurer dans un futur écran.
- Aucune intégration bancaire/D17 : la vérification des fonds est 100 % humaine.
- Pas de paiement partiel, remboursements, preuve jointe, relances automatiques, emails, SMS, TVA/facture fiscale ni rapprochement automatique.
- La liste admin est plafonnée à 200 dossiers ; prévoir pagination SQL/exports quand le volume augmentera.
- Le calcul de fin de période est en jours calendaires de 24 heures ; préciser les règles commerciales avant publication définitive.
- Toute modification manuelle de l'abonnement dans le panneau admin reste distincte de la traçabilité des dossiers de règlement. Pour une comptabilité SaaS complète, rapprocher ultérieurement ces opérations.

## Vérification automatique

Le workflow `.github/workflows/saas-billing.yml` utilise PostgreSQL 18 isolé et teste, via HTTP :
- Authentification admin/marchand, isolation entre deux marchands et CSRF.
- Déclarations D17 et espèces, absence d'activation au dépôt, refus motivé.
- Capture du tarif/durée, renouvellement et période créditée, tentatives de double approbation.
- Validation unique d'une référence bancaire/D17 ; refus des doublons déjà validés.
- Documents privés et consultation en HTML imprimable.
- Préservation des données du moteur e-commerce historique.

Migration additive `202611020002_subscription_payments` ; aucune modification destructive des tables anciennes.
