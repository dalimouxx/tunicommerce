# Éditeur de pages des boutiques indépendantes

Ce lot poursuit le bloc 6 du chantier. Le propriétaire d'une boutique indépendante initialisée dispose d'un éditeur à `/mes-boutiques/{shopId}/pages`, accessible depuis « Ma vitrine ». Les boutiques historiques liées à un Workspace conservent leur parcours existant.

## Utilisation

1. Créer un brouillon en choisissant un titre et une adresse courte, par exemple `a-propos`. L'adresse utilise des minuscules ASCII, chiffres et tirets ; elle reste stable après la création. Chaque boutique dispose de dix pages maximum, avec contrôle transactionnel en cas de créations simultanées.
2. Choisir français ou arabe pour la page, ajouter une description et composer jusqu'à douze sections : en-tête, texte, points forts, questions fréquentes ou appel vers le catalogue. Les flèches déplacent les sections, y compris au clavier ; les boutons permettent d'ajouter et retirer les éléments répétés.
3. Enregistrer le brouillon. L'aperçu ouvre le dernier brouillon enregistré dans un onglet privé réservé au propriétaire. Les champs non enregistrés ne sont pas inclus dans cet aperçu.
4. Publier explicitement la version enregistrée. La boutique doit être publiée et l'abonnement marchand actif. La page apparaît à `/vitrines/{slug}/pages/{pageSlug}` et dans la navigation de la page d'accueil de la boutique.
5. Les modifications enregistrées après publication restent dans le brouillon jusqu'à une nouvelle publication. Dépublier retire la page et son lien de navigation ; supprimer efface le brouillon et la version publiée après confirmation dans l'interface.

Une page arabe utilise une direction droite à gauche et un lien vers le catalogue en arabe. Les textes sont saisis par le marchand : aucune traduction automatique n'est effectuée.

## Stockage et sécurité

La migration additive `202611100002_shop_pages` crée `ShopPage`, reliée à `Shop` avec suppression en cascade. Les champs `draft` et `published` sont deux documents JSON distincts et validés. `version` fournit le contrôle optimiste ; `publishedAt` indique l'existence d'une publication. Le schéma commercial des commandes et produits n'est pas modifié.

Les écritures verrouillent la boutique, recontrôlent le rôle OWNER actif et l'identité du propriétaire de l'organisation, puis vérifient la version attendue. Une version obsolète retourne 409, sans écrasement. Le bouton de rechargement exige une confirmation si des champs locaux ont été modifiés. Une publication utilise exclusivement le brouillon enregistré ; le client ne peut pas fournir simultanément un contenu et une action de publication.

Les API privées utilisent le cookie marchand et les contrôles d'origine existants. Elles ne prennent aucun identifiant de propriétaire transmis dans le corps. Les accès croisés à une page d'une autre boutique sont refusés, y compris entre deux boutiques du même propriétaire. Les membres d'équipe et les utilisateurs inactifs n'ont pas accès à l'éditeur. Les aperçus demandent l'exclusion des moteurs de recherche, `no-store` et `no-referrer`.

Chaque requête publique, y compris les métadonnées, recontrôle la publication de la boutique et l'abonnement. Suspension, expiration ou retrait de la boutique rendent les pages indisponibles. La navigation utilise le titre de l'instantané publié pour éviter d'exposer un titre de brouillon.

Le rendu React affiche du texte avec échappement. Les types de sections et leurs champs sont limités côté serveur ; aucun champ HTML, script ou URL de bouton n'est accepté. Les boutons de contenu ciblent le catalogue de la boutique. Le document est limité à 24 000 octets UTF-8, les requêtes d'écriture à 32 000 octets, avec des plafonds sur chaque texte et liste.

## Périmètre restant du bloc 6

L'éditeur crée des pages complémentaires. La mise en page de la page d'accueil et les thèmes existants restent gérés par leur parcours actuel. Les images de section, le texte enrichi, l'historique de restauration et la modification d'adresse avec redirection ne sont pas inclus. L'interface repose sur un formulaire et des boutons d'ordre, sans déplacement à la souris.

Les domaines personnalisés, la vérification DNS et la configuration TLS sur l'hébergeur restent à développer. Aucune réservation de domaine, modification DNS, activation de prestataire ni publication sur l'hébergement n'est effectuée par ce lot.

## Vérifications

Les tests de validation couvrent les limites, les adresses invalides, les identifiants de sections dupliqués et les champs de script ou de lien non autorisés. La suite PostgreSQL/HTTP couvre les permissions, les aperçus privés, la séparation brouillon/publication, le rendu échappé, la navigation, les écritures concurrentes, les contrôles d'abonnement, les plafonds simultanés et les suppressions limitées à la boutique. Les données et le serveur utilisés sont locaux et jetables.

Résultats locaux : 332 tests unitaires et 140 tests PostgreSQL/HTTP réussis dans 19 suites d'intégration ; les huit tests du parcours pages réussissent également après ajout des contrôles sur une adhésion inactive et un rôle OWNER attribué à un compte qui ne possède pas l'organisation. TypeScript, compilation de production, migration locale et redémarrage sans migration supplémentaire réussis ; la comparaison Prisma ne détecte aucune différence.

La recette dans le navigateur sur un compte fictif a confirmé l'affichage de l'éditeur, le réordonnancement, l'enregistrement du brouillon et le maintien de l'ordre précédent sur la page publique. Une capture de l'éditeur a été conservée dans les livrables. La vérification porte sur la fenêtre de bureau disponible ; la recette sur appareils mobiles réels reste à faire.
