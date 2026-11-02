# TuniCommerce — Coordonnées officielles de réception des abonnements SaaS (pilote)

## Objet

Cette étape termine **l'affichage et la configuration sécurisée des instructions de réception** de D17, virement bancaire et remise d'espèces. Le site n'initie **aucune transaction** D17 ou bancaire : les opérations restent entièrement externes et vérifiées manuellement.

## Configuration de l'administrateur global

Ouvrir `/admin/coordonnees-paiement` avec un compte `ADMIN`. Les trois moyens de paiement sont ajoutés **désactivés et vides**, sans coordonnées bancaires ni numéro de téléphone inventés.

Pour chaque moyen :
- Renseigner le **bénéficiaire officiel** (identité juridique / personne habilitée).
- D17 : renseigner le **numéro bénéficiaire exact** et les instructions.
- Virement : renseigner la **banque**, le **RIB/IBAN exact** et les instructions.
- Espèces : renseigner les modalités précises de remise (lieu, horaires, personne habilitée), sans inventer d'adresse.
- Activer le moyen **après vérification indépendante** de ses coordonnées, confirmer l'activation dans l'interface puis sauvegarder.

Un moyen dont les informations obligatoires sont absentes ne peut pas être activé. Il peut être désactivé immédiatement. La mise à jour utilise un numéro de version optimiste pour éviter qu'un admin ne remplace silencieusement les modifications concurrentes.

Les actions sont journalisées dans `PaymentReceptionAudit` (auteur, méthode, version, champs modifiés, état d'activation). Les numéros de compte ne sont **pas recopiés** dans ce journal.

## Parcours marchand

Ouvrir `/mon-abonnement` avec le compte propriétaire d'un espace commercial :
- Les moyens de réception **activés et validés par le schéma** apparaissent avec leur bénéficiaire, numéro/RIB et instructions.
- Si aucun moyen n'est activé, un avertissement apparaît et il n'y a **aucun formulaire utilisable** de déclaration. Aucune coordonnée inactive n'est diffusée.
- Le serveur valide de nouveau l'activation du moyen **au moment de la déclaration**, y compris si la page marchand était déjà ouverte.
- Une déclaration demeure un dossier `PENDING` et ne change ni les dates ni le plan du marchand. Seul l'admin peut vérifier puis valider ou refuser.
- Les demandes déjà `PENDING` peuvent être traitées même si un moyen a été désactivé depuis leur dépôt (validation externe obligatoire).

## Sécurité, compatibilité, limites

- Migration additive `202611020003_payment_reception` : nouveaux modèles `PaymentReceptionMethod` et `PaymentReceptionAudit`; **aucune modification des commandes COD, des produits, des comptes existants ou des abonnements actifs**.
- Endpoints `/api/admin/payment-reception` accessibles uniquement à ADMIN (session et protection de même origine, Zod, limites de taille).
- Accès marchand `/api/v1/subscription-payments` seulement pour un compte **propriétaire de son propre Workspace**. Les champs administratifs (version, auteur, audit) ne sont pas publiés dans la liste des moyens actifs.
- Les moyens désactivés ne peuvent **pas** être utilisés dans une nouvelle demande de paiement.
- Pas de code PIN D17, mot de passe bancaire, clé API, coordonnées de carte ni secret de paiement dans la base. Les comptes bénéficiaires sont des informations de réception, destinées à être visibles aux commerçants authentifiés une fois activés.
- La fonctionnalité n'effectue aucune **vérification bancaire externe** de l'identité ou des fonds : la responsabilité de contrôler les coordonnées et les règlements reste à l'opérateur TuniCommerce.
- Pour une **vraie facture fiscale** : il manque toujours la personnalité juridique émettrice, le matricule fiscal, la politique de TVA, la numérotation et les mentions légales — ne pas qualifier les documents actuels de factures fiscales.
- Prévoir ensuite l'historique détaillé des règlements, les éventuels remboursements, les alertes de fraude, le support et les notifications d'expiration.

## Tests

Le workflow `.github/workflows/payment-reception.yml` vérifie sur PostgreSQL isolé :
1. Méthodes désactivées initialement, absence de paiement possible sans coordonnées officielles.
2. Rejet de configuration incomplète, d'une méthode inconnue et des requêtes CSRF.
3. Permissions ADMIN uniquement et numéros bancaires non repris dans l'audit.
4. Activation D17, affichage réservé aux marchands connectés, exclusion des moyens désactivés.
5. Protection des modifications concurrentes et désactivation immédiate.
6. Paiement D17 déjà déclaré pouvant être approuvé manuellement après désactivation du moyen.
7. Activation bancaire et parcours de déclaration après mise à jour.
8. Régression des demandes d'abonnement, renouvellements et attestations existants.
