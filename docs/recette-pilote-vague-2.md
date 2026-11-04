# TuniCommerce · Recette pilote de la vague 2

Cette procédure doit être effectuée **sur un environnement de test** avec au moins deux boutiques distinctes. Les tests automatiques dans `tests/wave2-cross-module-regression.test.ts` couvrent le moteur métier, pas l'authentification réelle, le navigateur, Neon ou un transporteur externe.

## Préparation

- Créer deux comptes marchands (A et B) et une boutique indépendante pour chacun.
- Ajouter à A deux agents Call Center distincts et un responsable avec les permissions requises.
- Configurer un transporteur **fictif** couvrant Gabès et un second hors zone.
- Utiliser des clients et références de paiement de test. **Ne pas utiliser de coordonnées ou règlements réels.**

## Tests manuels à faire signer

1. Depuis la boutique A, créer une commande COD : contrôler le prix, les frais, la quantité réservée, le lien client et le statut initial.
2. En tant que propriétaire A, affecter la commande à l'agent 1. Vérifier l'impact sur la charge et le nombre de rappels.
3. Connecté en agent 2, vérifier que la commande affectée à l'agent 1 ne s'affiche pas dans sa file Call Center et que le serveur refuse confirmation et annotation directes.
4. Connecté en agent 1, déclarer un contact réellement **simulé**, confirmer la commande et retrouver le journal.
5. Préparer le colis, sélectionner un transporteur compatible et vérifier qu'un transporteur hors zone est refusé côté serveur.
6. Expédier avec un numéro de suivi de test puis saisir le bon de remise ; refuser tout doublon sans modifier le statut.
7. Déclarer la commande livrée, saisir un versement COD de test, créer un bordereau du même montant puis effectuer son rapprochement manuel.
8. Télécharger le CSV d'audit COD et vérifier les montants, les écarts, l'ancienneté et l'absence de coordonnées client.
9. Recommencer avec deux montants différents et vérifier que le rapprochement est refusé ; le COD encaissé ne doit pas augmenter.
10. Avec le propriétaire B, tenter d'accéder aux pages et API de A. Refus requis (pas de fuite de données), y compris par modification d'URL.
11. Contrôler les logs, les notifications locales et l'affichage sur téléphone. Les notifications de page ne sont **pas des push mobiles persistantes**.
12. Vérifier la restauration d'une **base de test** et les erreurs de concurrence avant toute ouverture commerciale.

## Prestataires à connecter séparément

- API de création d'expéditions et de suivi d'au moins un transporteur tunisien, avec compte, contrat, clés et sandbox.
- SMS/WhatsApp et téléphonie (numéros, prestataire, consentements et modèles autorisés).
- Rapprochement bancaire réel : récupération de relevés ou API d'institution financière, droits et processus de validation.

Ne jamais qualifier un versement déclaré, une remise interne ou un rapprochement manuel de preuve bancaire ni d'accusé de réception API.
