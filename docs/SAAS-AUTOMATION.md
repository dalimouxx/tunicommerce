# Automatisation de l’abonnement marchand

L’abonnement porte sur le compte marchand et couvre toutes ses boutiques. Le contrôle des droits repose sur le statut et l’échéance côté serveur ; il fonctionne même sans worker. Une échéance atteinte ne supprime aucune donnée. Une suspension ou résiliation n’est jamais levée par un rappel.

## Rappels d’échéance

Dans **Mon abonnement → Rappels d’abonnement**, le titulaire peut activer ou désactiver les rappels envoyés à l’adresse vérifiée de son propre compte. Le réglage commence désactivé, y compris après migration des comptes existants. Aucun autre destinataire ne peut être renseigné. L’activation exige un service SMTP configuré ; la désactivation reste possible sans lui.

Le worker effectue un passage toutes les quinze minutes, par pages de cent comptes, espacées d’au moins cinq secondes. Pour chaque échéance, il prépare au plus un rappel par phase : entre sept jours et plus de 24 heures, dans les dernières 24 heures, puis dans les premières 24 heures après l’expiration. Un arrêt ne déclenche pas les phases manquées. Les comptes suspendus, résiliés, sans échéance ou sans adresse vérifiée sont exclus.

Un verrou sur le compte et une clé unique par échéance et phase empêchent deux workers de préparer deux rappels identiques. La file chiffrée conserve l’identité du destinataire, l’échéance et la version des préférences ; ni le catalogue ni les commandes ne sont chargés. Avant l’envoi, le worker relit ces informations. Un renouvellement, un changement d’adresse, une perte de vérification, une modification de l’offre ou des préférences rend l’ancien rappel caduc.

Désactiver les rappels annule les tâches encore en attente et efface leur contenu. Une phase déjà préparée n’est pas rejouée lors d’une réactivation. Un message en cours peut néanmoins terminer son envoi. Quatre tentatives au maximum, avec reprise temporisée et Message-ID stable ; l’acceptation SMTP ne prouve pas la réception et un doublon reste possible après une panne. Les tâches périmées sont neutralisées après 48 heures ; les métadonnées terminales sont purgées après trente jours. Les vingt dernières tentatives sont visibles uniquement par le titulaire.

## Renouvellement et paiement

Les rappels n’effectuent aucun débit et ne prolongent pas l’abonnement. Le parcours actuel conserve la déclaration de règlement externe et sa validation administrative explicite. Une validation conserve les jours encore valides et est idempotente.

Pour terminer les prélèvements automatiques, il reste à sélectionner un prestataire compatible avec l’activité et le pays, obtenir un compte de test, développer son adaptateur et vérifier les notifications signées, les montants/devises et la déduplication auprès du prestataire. Un retour navigateur ou une déclaration du marchand ne constituera pas une confirmation de paiement. Les scénarios de refus, renouvellement, annulation, remboursement et panne doivent être validés dans son environnement de test avant activation réelle. Aucun numéro de carte n’est à stocker dans Tunicom.

## Exploitation

Configurer le chiffrement, l’URL canonique HTTPS, SMTP et un worker avec les mêmes secrets que le serveur. `npm run worker:health` vérifie sa présence et l’état de la file. La présence de variables SMTP ne prouve pas leur validité : faire la recette avec une adresse de test autorisée. Sur le Render de test, aucun service de messagerie n’est activé par ce lot.
