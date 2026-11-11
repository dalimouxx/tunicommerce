# Accueil personnalisable des boutiques

Le propriétaire ouvre **Ma vitrine** dans le menu de son espace marchand, puis **Composer et publier mon accueil**. L'accès existe aussi dans **Mes boutiques → Modifier l’accueil** et dans la fiche de la boutique. L'éditeur prend en charge la boutique existante liée au workspace et les boutiques indépendantes initialisées. Les thèmes historiques et les quatre thèmes animés restent disponibles. Sans accueil personnalisé publié, la vitrine conserve le comportement du thème actuel.

## Édition et publication

Chaque langue, français et arabe, dispose de son titre principal, sa présentation, son bandeau et de huit sections au maximum. Les sections sont de cinq types : en-tête, texte, points forts, questions fréquentes et bouton vers le catalogue. Elles peuvent être ajoutées, réordonnées ou retirées ; aucune section personnalisée n'est obligatoire. Les champs d'en-tête vides utilisent les textes habituels de la boutique. Aucune traduction automatique n'est effectuée.

La disposition permet de placer les sections avant ou après le catalogue et de masquer les trois points de réassurance standards. Le catalogue et le panier ne peuvent pas être retirés par cette configuration. Les photos d'en-tête restent gérées dans Apparence ; ce lot n'ajoute ni image de section ni CSS/HTML marchand exécutable. Les textes sont rendus avec l'échappement React et les boutons ciblent seulement le catalogue de la boutique.

**Enregistrer le brouillon** conserve les modifications sans toucher à la version publique. L'aperçu privé existant montre les textes et sections enregistrés, dans la langue sélectionnée et avec le thème choisi. Les commandes y restent désactivées. Les changements non enregistrés ne sont pas affichés dans l'aperçu.

**Publier l’accueil enregistré** copie le brouillon des deux langues dans un instantané public. Une boutique publiée et un abonnement actif ou d'essai, non expiré, sont requis. Une modification ultérieure du brouillon n'altère pas cet instantané. **Restaurer le brouillon depuis la version publiée** recopie cet instantané sans publier de changement. **Revenir à l’accueil du thème** retire la personnalisation publique tout en conservant le brouillon, les produits, le stock et les commandes. Ce mécanisme conserve une seule version publique : ce n'est pas un historique de versions.

## Isolation et persistance

`ShopHome` contient un seul enregistrement par boutique : brouillon, instantané public, version attendue et métadonnées de publication. La migration est additive et ne réécrit ni `Workspace.data` ni `ShopCommerce.data`. Consulter l'éditeur ne crée aucun enregistrement. La suppression d'une boutique supprime son accueil par cascade.

`GET /api/v1/shops/<shopId>/home` et `PUT` exigent une session marchand et le véritable propriétaire, avec appartenance OWNER active. Pour une boutique existante, le propriétaire de l'organisation et celui du workspace lié doivent tous deux correspondre à ce compte. L'administrateur global ne dispose pas d'un contournement. Les écritures exigent l'origine canonique et un corps JSON strict, borné à 43 000 octets ; le contenu validé est limité à 40 000 octets UTF-8. Les écritures se sérialisent par verrou de boutique, précédé du verrou du workspace pour une boutique existante, et vérifient la version attendue : un conflit renvoie 409 au lieu d'écraser une autre modification.

La vitrine ne lit que l'instantané publié, après les contrôles habituels de publication et d'abonnement. Le contenu fonctionne également via le routage de domaine vérifié. Le Proxy continue de refuser les routes d'édition et les API privées sur les domaines de boutiques. Les médias du lot précédent, les anciens thèmes et le checkout COD restent inchangés.

## Compatibilité avec la boutique existante

La boutique historique conserve son adresse `/boutiques/<slug-du-workspace>` et son API de commande. Aucune migration ou copie du catalogue et des commandes n'est nécessaire. Sa publication est vérifiée sur le workspace réel, même si le statut de l'entité Shop diffère. L'accueil publié y remplace les textes d'en-tête et ajoute les sections, avec un sélecteur français/arabe pour ce contenu. Les contrôles du catalogue et du checkout historiques restent en français ; cette compatibilité n'en constitue pas une traduction complète.

L'aperçu `/mes-boutiques/<shopId>/accueil/apercu` reste privé et sans commande, y compris lorsque la boutique est dépubliée. Sans personnalisation publiée, les textes et l'apparence historiques restent utilisés. Le contrôle des trois points de réassurance standards est réservé au catalogue indépendant qui possède ces blocs. Les pages complémentaires et domaines ne sont pas étendus aux boutiques historiques par cette correction.

## Validation et limites

Les tests couvrent les valeurs par défaut, les langues indépendantes, les limites de sections et de volume UTF-8, les champs exécutables refusés, les versions attendues, les accès anonymes/étrangers, les origines falsifiées, les premières sauvegardes simultanées, l'aperçu privé et l'échappement du texte, les instantanés publiés, la restauration, le retour au thème et la conservation des données commerciales. La suite des domaines vérifie aussi qu'un domaine personnel affiche la version publiée sans révéler le brouillon.

La recette navigateur locale vérifie la sauvegarde, le réordonnancement, la publication, les langues, la FAQ et les formats étroit et large. Un défaut de compression du nom dans l’en-tête mobile a été corrigé par une disposition sur deux lignes. Les essais sur appareils physiques restent à effectuer. Les animations des sections des thèmes récents respectent la réduction de mouvement et le bouton de pause existant. Restent à développer : images de sections avec stockage adapté, historique de restauration et composition plus libre des blocs métier.

