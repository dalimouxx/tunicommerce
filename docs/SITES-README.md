# TuniCommerce — version privée 0.3

Application de gestion e-commerce tunisien créée à partir du cahier des charges fourni. Cette livraison est une tranche opérationnelle privée, **pas encore le SaaS complet commercialisable** décrit par les 97 sections.

## Fonctionnel
- Tableau de bord, indicateurs calculés, période, graphique, export CSV.
- Catalogue avec références/variantes simples, prix et coûts en millimes, édition.
- Stock disponible, réservations à la commande, historique, corrections explicites.
- Clients créés/rapprochés par numéro tunisien.
- Commandes multi-articles, coupons, total recalculé au serveur.
- Workflow contrôlé : confirmation, rappel, préparation, expédition, livraison, refus de livraison.
- Annulation avec restitution du stock ; retour en stock uniquement après confirmation du contrôle.
- Notes, chronologie et audit des actions.
- Versements COD partiels, protection contre les surpaiements, dépenses et marge opérationnelle.
- Analyses produits/gouvernorats, paramètres boutique.
- Données persistantes D1, isolées par identité ChatGPT, accès privé.

## Ajouts 0.2
- Boutique de test privée avec catalogue, panier persistant et checkout réel dans l’espace du propriétaire.
- Paniers actifs, convertis et détection visuelle d’abandon après une heure.
- Réception de retours après livraison, quantité contrôlée, remise d’origine répartie au millime, avoir, stock après contrôle.
- Remboursements partiels enregistrés, distincts des versements COD.
- Factures commerciales en brouillon, émission avec instantané figé, impression / enregistrement PDF via le navigateur. TVA et mentions fiscales non configurées.

## Limites importantes
Une boutique par propriétaire. Pas encore d'inscription email/mot de passe, équipe/RBAC, organisations, boutique publique, multi-entrepôt, échanges, facture fiscale et génération PDF serveur, imports, arabe/RTL, automatisation exécutée, abonnement ni marketplace. Les intégrations transporteurs, messagerie, publicité et IA sont **non connectées**.

L'hébergement Sites utilise Cloudflare Workers, D1 et Drizzle. PostgreSQL/Prisma/Docker et l'architecture multi-marchands à grande échelle ne sont pas livrés ici. L'agrégat JSON versionné assure des mutations atomiques à faible volume, mais doit être normalisé avant une exploitation importante.

## Exécution
Node 24, dépendances avec pnpm. `npm run dev`, `npm run build`, `node node_modules/typescript/bin/tsc --noEmit`, `node --test tests/commerce.test.mjs`.
Consulter `docs/STARTER-RUNTIME.md` pour la migration locale D1 et l'environnement Sites. La configuration suivie est `.openai/hosting.json` ; aucun secret n'est requis pour les modules locaux.

## Connexion et démonstration
Connexion ChatGPT via `/signin-with-chatgpt?return_to=%2F`. Aucun mot de passe démo codé en dur. Un espace neuf reçoit des données fictives clairement signalées. Dans Paramètres, l'action « Vider les données » exige le texte EFFACER ; elle ne touche que l'espace courant. Le mode non connecté est un aperçu en lecture seule.

## Données financières
Les montants sont des entiers en millimes (1 TND = 1000). CA = commandes livrées, livraison facturée incluse. Les avoirs après retour réduisent le revenu ; le coût produit est récupéré uniquement pour un article revendable. Le versement COD ne crée pas de nouveau revenu et reste calculé sur le montant initial livré. Un remboursement enregistré solde la dette envers le client sans diminuer deux fois le revenu. Les coûts du transporteur sont figés à l’expédition et corrigibles avec justification. Les anciennes expéditions manuelles gardent une estimation de 7 TND livrée et 14 TND refusée. La marge affichée n'est pas un résultat comptable fiscal. La période sélectionne les cohortes par date de création de commande et les dépenses par leur date.

## Ajouts 0.3
Zones par gouvernorat, frais et seuil de gratuité après remise, transporteurs et couverture, comparaison des tarifs et résultats locaux, coûts figés par expédition et correction auditée. Score client explicable et alertes de doublon sans blocage automatique. Aucun appel à une API transporteur.
