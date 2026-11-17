# Galerie de photos produit

## Pour le marchand

- Un produit peut avoir **jusqu'à 8 photos**. La première est la photo principale : elle apparaît dans le catalogue, le panier et les partages. Les autres s'affichent sur la page du produit.
- Dans la fiche produit (boutique historique) et dans « Modifier le produit » (boutiques indépendantes) :
  - touchez une photo de la médiathèque pour l'ajouter, puis touchez-la à nouveau pour la retirer ;
  - les boutons ←/→ changent l'ordre, ★ met une photo en principale et ✕ la retire ;
  - on peut aussi ajouter un lien `https://`.
- Les boutiques indépendantes peuvent maintenant utiliser les photos de la médiathèque du propriétaire. Avant, seules les adresses HTTPS étaient acceptées.

## En boutique

- Page produit `/vitrines/{slug}/produit/{id}` : avec plusieurs photos, on les fait glisser d'un doigt ou on clique une vignette.
  - Au clavier, les flèches passent d'une photo à l'autre, y compris en arabe.
  - La photo affichée est signalée aux lecteurs d'écran.
  - Sans JavaScript, les photos restent faciles à parcourir par défilement.
- Une seule photo : affichage identique à avant.
- Les données de référencement (`Product.image`) listent toutes les photos.
- Les cartes du catalogue et la boutique historique (`/boutiques`, sans page produit) gardent la photo principale.

## Règles de sécurité

- Chaque photo de la médiathèque citée par un produit (principale ou galerie) doit appartenir au propriétaire de la boutique, sinon refus 403.
- Pour les boutiques indépendantes, ce contrôle est fait dans la transaction, sous le verrou du propriétaire.
- Une photo de galerie n'est publique que si elle est utilisée par un produit actif d'une boutique publiée. C'est la même règle que pour la photo principale, y compris sur un domaine de boutique.
- Une photo utilisée par un produit, dans n'importe quelle boutique du propriétaire, ne peut pas être supprimée de la médiathèque (409).

## Code

- `modules/product-media/gallery.ts` : limite, ordre, collecte des identifiants et transitions de l'éditeur.
- `components/product-photos-editor.tsx` : éditeur côté marchand.
- `components/product-gallery.tsx` : galerie côté boutique.

## Vérifications

- Tests unitaires : `tests/product-gallery.test.ts`.
- Intégration sur PostgreSQL : `tests/product-gallery-api.test.ts`. Elle couvre la propriété des photos, l'accès public selon la publication et la protection contre la suppression.
- Captures Chromium :
  - thèmes Oasis et Magazine sur ordinateur, Médina en arabe et Souk sur mobile ;
  - vérification de la vignette cliquée, des flèches du clavier et des données de référencement, sans débordement ni erreur JavaScript.
- Contenu envoyé par les deux formulaires marchands : vérifié dans le navigateur.

## Limites

- Après un import de plusieurs photos (PR #165), chaque photo s'ajoute au produit d'un toucher. L'import ne les ajoute pas d'office.
- Pas de zoom plein écran sur la page produit.
