# TuniCommerce — Priorité 1 : annuaire administratif exhaustif

Nouvelle page **/admin/abonnements/complet** : recherche PostgreSQL sur les marchands, e-mails,
slugs, noms de boutiques relationnelles et plans, avec filtres exclusifs et pagination serveur
de 50 comptes. Les résultats portent sur **tous** les comptes, sans limite silencieuse à 200.

L'ancienne page /admin/abonnements conserve sa vue rapide de 200 boutiques, sans rupture.
La nouvelle page est accessible depuis ce tableau de bord.

## Export CSV

**/api/admin/subscriptions/export?statut=expired&recherche=...&page=1**
exporte exactement les comptes de la page filtrée (50 lignes maximum).
Les champs texte sont protégés contre les injections de formule et de lignes CSV.
Le fichier porte `Cache-Control: private, no-store`. Le contrôleur exige une
session ADMIN ; les sessions marchandes ne peuvent lire les données globales.
Aucun état d'abonnement ni donnée client/commande n'est modifié.

Les résultats sont triés par échéance puis identifiant. Entre deux pages,
les nouveaux changements administratifs peuvent déplacer des lignes : l'export
est une photographie paginée, pas un snapshot comptable. Pour archiver toute
la plateforme, exporter successivement chaque page durant une fenêtre de gel
ou implémenter ultérieurement un snapshot transactionnel audité.

## Limites importantes

Les statuts et dates ne prouvent aucun encaissement bancaire.
Le rapport ne traite pas l'impôt, la facturation fiscale ni le rapprochement bancaire.
Le portail finance SaaS contient séparément les demandes de paiement approuvées
manuellement et le suivi des échéances.

La sauvegarde indépendante de Neon reste une condition distincte de commercialisation :
voir `docs/priority1-neon-recovery-runbook.md`.
