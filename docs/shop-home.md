# Accueil personnalisable des boutiques

Le propriétaire ouvre **Ma vitrine** dans le menu de son espace marchand, puis **Composer et publier mon accueil**. L'accès existe aussi dans **Mes boutiques → Modifier l’accueil** et dans la fiche de la boutique. L'éditeur prend en charge la boutique existante liée au workspace et les boutiques indépendantes initialisées. Les thèmes historiques et les quatre thèmes animés restent disponibles. Sans accueil personnalisé publié, la vitrine conserve le comportement du thème actuel.

## Édition et publication

Chaque langue, français et arabe, dispose de son titre principal, sa présentation, son bandeau et de huit sections au maximum. Les sections sont de six types : en-tête, texte, points forts, questions fréquentes, bouton vers le catalogue et image avec légende. Elles peuvent être ajoutées, réordonnées ou retirées ; aucune section personnalisée n'est obligatoire. Les champs d'en-tête vides utilisent les textes habituels de la boutique. Aucune traduction automatique n'est effectuée.

La disposition permet de placer les sections avant ou après le catalogue et de masquer les trois points de réassurance standards. Le catalogue et le panier ne peuvent pas être retirés par cette configuration. Les photos d'en-tête restent gérées dans Apparence. Les textes sont rendus avec l'échappement React et les boutons ciblent seulement le catalogue de la boutique. Aucun CSS/HTML marchand exécutable n'est accepté.

## Images dans l'accueil

Choisir « Image et légende » puis « Choisir ou importer une photo » ouvre la médiathèque existante. Ses imports PNG/JPEG/WebP utilisent la compression et les quotas du marchand déjà en place : 400 Ko après optimisation, dimensions et formats vérifiés côté serveur. Cette bibliothèque est commune aux boutiques du même propriétaire. Un lien HTTPS sans identifiants peut aussi être utilisé ; le serveur n'effectue aucune requête vers cet hébergeur externe et ne certifie pas la disponibilité ou le contenu du fichier.

Chaque section exige un titre et un texte alternatif ; la légende est facultative. Le format peut être paysage, carré ou portrait, avec image entière ou recadrage pour remplir le cadre. Le navigateur charge les visuels à la demande, avec décodage asynchrone et sans transmettre l'URL de la page comme référent. Une copie locale d'une image encore incomplète reste récupérable.

Une photo interne doit appartenir au marchand lors de l'enregistrement, de la publication et de la restauration. Les images de l'accueil public utilisent `/api/v1/public/vitrines/<slug-du-Shop>/images/<id>` : l'accès exige une boutique réellement ouverte, une référence dans l'instantané publié et un fichier du bon propriétaire. Cette route n'autorise pas une image seulement présente dans le brouillon, une autre boutique ou un autre marchand, même si le visiteur possède une session valide. Le contrôle de publication utilise le workspace pour une boutique historique et les règles d'abonnement/publication de la boutique indépendante dans les autres cas.

Le rendu fonctionne sur la vitrine historique, sur `/vitrines/<slug>` et sur un domaine vérifié. L'aperçu privé conserve les URLs de la médiathèque accessibles au propriétaire. Les URLs d'origine de cette médiathèque gardent leur politique de visibilité existante : une image peut déjà être accessible lorsque la boutique historique est publiée ; le brouillon ne constitue pas un coffre de fichiers confidentiels.

La suppression d'une photo est refusée tant qu'un accueil enregistré l'utilise dans son brouillon ou son instantané publié. Enlever l'image du brouillon ne suffit pas si l'ancienne version publique la référence encore. Les écritures d'accueil et la suppression se sérialisent par le workspace du propriétaire pour empêcher une référence enregistrée vers une photo supprimée simultanément. Les liens externes restent sous la responsabilité de leur hébergeur.

Ce lot ne provisionne aucun stockage objet et ne change pas les données commerciales ni le schéma SQL. Les blobs restent dans le stockage actuel ; son externalisation est un chantier distinct. Les anciennes sections restent compatibles. Un retour au code précédent après enregistrement d'une section image nécessite de conserver la prise en charge de ce nouveau type de contenu.

**Enregistrer le brouillon** conserve les modifications sans toucher à la version publique. L'aperçu privé existant montre les textes et sections enregistrés, dans la langue sélectionnée et avec le thème choisi. Les commandes y restent désactivées. Les changements non enregistrés ne sont pas affichés dans l'aperçu.

**Publier l’accueil enregistré** copie le brouillon des deux langues dans un instantané public. Une boutique publiée et un abonnement actif ou d'essai, non expiré, sont requis. Une modification ultérieure du brouillon n'altère pas cet instantané. **Restaurer le brouillon depuis la version publiée** recopie cet instantané sans publier de changement. **Revenir à l’accueil du thème** retire la personnalisation publique tout en conservant le brouillon, les produits, le stock et les commandes. Ce mécanisme conserve une seule version publique : ce n'est pas un historique de versions.

## Isolation et persistance

`ShopHome` contient un seul enregistrement par boutique : brouillon, instantané public, version attendue et métadonnées de publication. La migration est additive et ne réécrit ni `Workspace.data` ni `ShopCommerce.data`. Consulter l'éditeur ne crée aucun enregistrement. La suppression d'une boutique supprime son accueil par cascade.

`GET /api/v1/shops/<shopId>/home` et `PUT` exigent une session marchand et le véritable propriétaire, avec appartenance OWNER active. Pour une boutique existante, le propriétaire de l'organisation et celui du workspace lié doivent tous deux correspondre à ce compte. L'administrateur global ne dispose pas d'un contournement. Les écritures exigent l'origine canonique et un corps JSON strict, borné à 43 000 octets ; le contenu validé est limité à 40 000 octets UTF-8. Les écritures se sérialisent par verrou de boutique, précédé du verrou du workspace pour une boutique existante, et vérifient la version attendue : un conflit renvoie 409 au lieu d'écraser une autre modification.

La vitrine ne lit que l'instantané publié, après les contrôles habituels de publication et d'abonnement. Le contenu fonctionne également via le routage de domaine vérifié. Le Proxy continue de refuser les routes d'édition et les API privées sur les domaines de boutiques. Les médias du lot précédent, les anciens thèmes et le checkout COD restent inchangés.

## Compatibilité avec la boutique existante

La boutique historique conserve son adresse `/boutiques/<slug-du-workspace>` et son API de commande. Aucune migration ou copie du catalogue et des commandes n'est nécessaire. Sa publication est vérifiée sur le workspace réel, même si le statut de l'entité Shop diffère. L'accueil publié y remplace les textes d'en-tête et ajoute les sections, avec un sélecteur français/arabe pour ce contenu. Les contrôles du catalogue et du checkout historiques restent en français ; cette compatibilité n'en constitue pas une traduction complète.

L'aperçu `/mes-boutiques/<shopId>/accueil/apercu` reste privé et sans commande, y compris lorsque la boutique est dépubliée. Sans personnalisation publiée, les textes et l'apparence historiques restent utilisés. Le contrôle des trois points de réassurance standards est réservé au catalogue indépendant qui possède ces blocs. Les pages complémentaires et domaines ne sont pas étendus aux boutiques historiques par cette correction.

## Brouillons locaux et enregistrements simultanés

L'éditeur conserve les modifications dans le stockage de session de l'onglet, avec une clé distincte pour chaque compte et chaque boutique. Une copie retrouvée, datant de moins de 24 heures, peut être récupérée avant de reprendre l'édition. Les champs encore incomplets sont conservés aussi : ils devront être corrigés avant l'enregistrement serveur. Une navigation interne enregistre immédiatement la copie avant de quitter l'éditeur. Fermer l'onglet, effacer les données du navigateur ou refuser le stockage peut empêcher cette récupération ; l'écran signale l'indisponibilité d'une copie locale. La copie locale ne publie rien et ne remplace pas une sauvegarde confirmée par le serveur.

Lorsqu'une version a changé, les modifications sur des champs distincts peuvent être réunies automatiquement. Une liste de sections est traitée comme un ensemble : deux changements concurrents de son ordre ou de son contenu nécessitent un choix, afin de ne pas perdre une section. Si le même champ a été modifié différemment, les textes locaux restent affichés et le propriétaire peut consulter la version du serveur, la charger ou confirmer explicitement son remplacement. Aucune publication n'est effectuée pendant cette réconciliation.

Une sauvegarde déjà reçue par le serveur mais dont la réponse a été perdue est reconnue à la tentative suivante. Le client ne réessaie qu'une fois une écriture après lecture d'une version récente ; une nouvelle concurrence est présentée comme conflit. Les délais réseau sont bornés à 45 secondes pour rendre les boutons disponibles en cas de panne. Une session expirée propose une reconnexion dans un autre onglet. Les messages de validation nomment la langue et la section, ouvrent la langue concernée et ciblent le champ à compléter.

La barre Enregistrer/Publier reste accessible pendant le défilement. L'enregistrement du brouillon, sa copie locale et sa publication disposent d'indications distinctes. Les protections serveur de version attendue et de propriétaire restent inchangées.

## Validation et limites

Les tests couvrent les valeurs par défaut, les langues indépendantes, les limites de sections et de volume UTF-8, les champs exécutables refusés, les versions attendues, les accès anonymes/étrangers, les origines falsifiées, les premières sauvegardes simultanées, l'aperçu privé et l'échappement du texte, les instantanés publiés, la restauration, le retour au thème et la conservation des données commerciales. La suite des domaines vérifie aussi qu'un domaine personnel affiche la version publiée sans révéler le brouillon.

La recette navigateur locale vérifie la sauvegarde, le réordonnancement, la publication, les langues, la FAQ et les formats étroit et large. Un défaut de compression du nom dans l’en-tête mobile a été corrigé par une disposition sur deux lignes. Les essais sur appareils physiques restent à effectuer. Les animations des sections des thèmes récents respectent la réduction de mouvement et le bouton de pause existant. Restent à développer : stockage objet adapté, historique de restauration et composition plus libre des blocs métier.


