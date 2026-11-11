# Éditeur de pages des boutiques indépendantes

Ce lot poursuit le bloc 6 du chantier. Le propriétaire d'une boutique indépendante initialisée dispose d'un éditeur à `/mes-boutiques/{shopId}/pages`, accessible depuis « Ma vitrine ». Les boutiques historiques liées à un Workspace conservent leur parcours existant.

## Utilisation

1. Créer un brouillon en choisissant un titre et une adresse courte, par exemple `a-propos`. L'adresse utilise des minuscules ASCII, chiffres et tirets ; elle reste stable après la création. Chaque boutique dispose de dix pages maximum, avec contrôle transactionnel en cas de créations simultanées.
2. Choisir français ou arabe pour la page, ajouter une description et composer jusqu'à douze sections : en-tête, texte, points forts, questions fréquentes appel vers le catalogue ou image avec légende. Les flèches déplacent les sections, y compris au clavier ; les boutons permettent d'ajouter et retirer les éléments répétés.
3. Enregistrer le brouillon. L'aperçu ouvre le dernier brouillon enregistré dans un onglet privé réservé au propriétaire. Les champs non enregistrés ne sont pas inclus dans cet aperçu.
4. Publier explicitement la version enregistrée. La boutique doit être publiée et l'abonnement marchand actif. La page apparaît à `/vitrines/{slug}/pages/{pageSlug}` et dans la navigation de la page d'accueil de la boutique.
5. Les modifications enregistrées après publication restent dans le brouillon jusqu'à une nouvelle publication. Dépublier retire la page et son lien de navigation ; supprimer efface le brouillon, la version publiée et tout son historique après confirmation dans l'interface.
6. « Consulter l’historique de la page » affiche ses 20 dernières étapes. Une sélection charge l’aperçu privé. Restaurer demande d’abord d’enregistrer les modifications locales, puis une confirmation dans la page ; le contenu et la langue reviennent dans le brouillon. L’adresse et la publication restent inchangées jusqu’à une nouvelle publication explicite.

Une page arabe utilise une direction droite à gauche et un lien vers le catalogue en arabe. Les textes sont saisis par le marchand : aucune traduction automatique n'est effectuée.

## Stockage et sécurité

La migration additive `202611100002_shop_pages` crée `ShopPage`, reliée à `Shop` avec suppression en cascade. Les champs `draft` et `published` sont deux documents JSON distincts et validés. `version` fournit le contrôle optimiste ; `publishedAt` indique l'existence d'une publication. Le schéma commercial des commandes et produits n'est pas modifié.

Les écritures verrouillent la boutique, recontrôlent le rôle OWNER actif et l'identité du propriétaire de l'organisation, puis vérifient la version attendue. Une version obsolète retourne 409, sans écrasement. Le bouton de rechargement exige une confirmation si des champs locaux ont été modifiés. Une publication utilise exclusivement le brouillon enregistré ; le client ne peut pas fournir simultanément un contenu et une action de publication.

Les API privées utilisent le cookie marchand et les contrôles d'origine existants. Elles ne prennent aucun identifiant de propriétaire transmis dans le corps. Les accès croisés à une page d'une autre boutique sont refusés, y compris entre deux boutiques du même propriétaire. Les membres d'équipe et les utilisateurs inactifs n'ont pas accès à l'éditeur. Les aperçus demandent l'exclusion des moteurs de recherche, `no-store` et `no-referrer`.

Chaque requête publique, y compris les métadonnées, recontrôle la publication de la boutique et l'abonnement. Suspension, expiration ou retrait de la boutique rendent les pages indisponibles. La navigation utilise le titre de l'instantané publié pour éviter d'exposer un titre de brouillon.

Le rendu React affiche du texte avec échappement. Les types de sections et leurs champs sont limités côté serveur ; aucun champ HTML, script ou URL de bouton n'est accepté. Les boutons de contenu ciblent le catalogue de la boutique. Le document est limité à 24 000 octets UTF-8, les requêtes d'écriture à 32 000 octets, avec des plafonds sur chaque texte et liste.

## Périmètre restant du bloc 6

L'éditeur crée des pages complémentaires. La mise en page de la page d'accueil et les thèmes existants restent gérés par leur parcours actuel. Le texte enrichi et la modification d'adresse avec redirection ne sont pas inclus. L'interface repose sur un formulaire et des boutons d'ordre, sans déplacement à la souris.

Les domaines personnalisés et leur preuve TXT disposent désormais de leur propre parcours ; leur recette DNS/TLS réelle reste prévue sur le futur VPS. Le routage reste désactivé par défaut sur Render. Voir `VPS-STOREFRONT-DOMAINS.md`. Ce lot d’historique ne modifie ni DNS ni prestataire.

## Historique privé par page

La migration additive `202611110004_page_history` ajoute `ShopPage.history` avec une liste vide par défaut. Les lectures ne créent pas de version et ne modifient aucun contenu existant. La première mutation réussie conserve le brouillon antérieur et, s’il est distinct, l’instantané publié. L’ancien modèle ne mémorisait pas le numéro de publication : cette étape est affichée « Avant historique » plutôt qu’avec un numéro inventé. Les nouvelles pages conservent leur création en version zéro.

Chaque création, enregistrement, publication, retrait et restauration réussis ajoutent une étape ; seules les 20 dernières sont gardées. Les écritures rejetées ne changent rien. Il n’y a ni durée garantie, ni récupération des contenus écrasés avant cette mise à jour, ni restauration d’une page supprimée. Le contenu (24 000 octets maximum par étape) est conservé avec sa langue et ses sections ; l’adresse stable et l’identifiant de page ne font pas partie des éléments restaurés.

`GET /api/v1/shops/[shopId]/pages/[pageId]/history` donne une liste de résumés sans corps de page. `GET .../history/[id]` donne la seule étape sélectionnée. Les deux accès recontrôlent le véritable propriétaire, l’appartenance active et la relation boutique/page ; les identifiants d’une autre page ou boutique sont refusés, même pour le même marchand. Les réponses ne sont pas mises en cache. La restauration utilise l’API PUT existante avec `action: restoreRevision`, `revisionId` et `version`, en conservant les contrôles d’origine et le verrou de boutique.

Une restauration reste possible pour une boutique non publiée ou un abonnement suspendu, car elle ne publie rien. Publier la page continue d’exiger une boutique ouverte avec un abonnement valide. La vitrine, sa navigation et ses métadonnées ne lisent que l’instantané publié. L’historique des pages est distinct de celui de l’accueil et reste réservé aux boutiques indépendantes initialisées.

## Vérifications

Les tests de validation couvrent les limites, les adresses invalides, les identifiants de sections dupliqués et les champs de script ou de lien non autorisés. La suite PostgreSQL/HTTP couvre les permissions, les aperçus privés, la séparation brouillon/publication, le rendu échappé, la navigation, les écritures concurrentes, les contrôles d'abonnement, les plafonds simultanés et les suppressions limitées à la boutique. Les données et le serveur utilisés sont locaux et jetables.

Résultats locaux : 332 tests unitaires et 140 tests PostgreSQL/HTTP réussis dans 19 suites d'intégration ; les huit tests du parcours pages réussissent également après ajout des contrôles sur une adhésion inactive et un rôle OWNER attribué à un compte qui ne possède pas l'organisation. TypeScript, compilation de production, migration locale et redémarrage sans migration supplémentaire réussis ; la comparaison Prisma ne détecte aucune différence.

La recette dans le navigateur sur un compte fictif a confirmé l'affichage de l'éditeur, le réordonnancement, l'enregistrement du brouillon et le maintien de l'ordre précédent sur la page publique. Une capture de l'éditeur a été conservée dans les livrables. La vérification porte sur la fenêtre de bureau disponible ; la recette sur appareils mobiles réels reste à faire.

## Images dans les pages complémentaires

La section « Image et légende » utilise la médiathèque du marchand, avec import et compression existants, ou une URL HTTPS sans identifiants. Le titre et le texte alternatif sont obligatoires ; la légende est facultative. Trois formats (paysage, carré, portrait) et deux ajustements (recadrer ou image entière) sont disponibles. La limite de 12 sections et le volume de 24 000 octets par page restent inchangés. Les champs sont éditables dans la langue de la page ; aucune traduction automatique.

Les sauvegardes, créations, publications et restaurations recontrôlent la propriété de chaque photo interne. Les écritures de page verrouillent désormais Workspace puis Shop, comme les suppressions de médias, afin qu’une suppression concurrente ne laisse pas de référence enregistrée vers un fichier disparu. Les photos utilisées par les brouillons, publications ou 20 étapes retenues des pages sont protégées contre la suppression. Leur présence dans un historique ne les rend pas publiques.

La route GET/HEAD /api/v1/public/vitrines/[slug]/pages/[pageSlug]/images/[id] exige une boutique indépendante ouverte, une page publiée à cette adresse, une référence dans son seul instantané publié et un média du propriétaire. Les brouillons et historiques ne sont pas lus pour cet accès. Une session valide ne contourne pas ces conditions. Les domaines personnalisés n’acceptent que la route de leur boutique ; les routes brutes de médiathèque conservent leur politique existante. Si le Workspace historique est publié, certains fichiers bruts peuvent déjà être publics : l’éditeur ne constitue pas un coffre de fichiers confidentiels.

L’aperçu privé et l’historique utilisent l’URL de médiathèque du propriétaire. Les rendus publics utilisent une URL limitée à la page et des images différées, avec décodage asynchrone et sans référent. Le backend ne télécharge pas les images HTTPS externes et n’en garantit pas la disponibilité. Aucun nouveau schéma SQL, stockage objet, fournisseur ni activation DNS. Les anciens contenus restent compatibles ; un retour au code antérieur après ajout de sections image exige de conserver la prise en charge du nouveau type dans les pages et leur historique.
