# TuniCommerce — Vague 5 : porte de lancement commercial

## État : pilotage / NO-GO par défaut

Le code disponible est déployable sur Render, **mais un déploiement Live
ne prouve pas qu'une activité commerciale est prête à être lancée**.
Le contrôle Go/No-Go est une protection opérationnelle, pas une
certification juridique, bancaire, technique ou de confidentialité.

Le script `node scripts/p5-commercial-readiness.mjs` retourne **NO-GO**
et un code d'échec tant que les sept attestations explicites ne sont pas
égales exactement à `true`.

## Validation et preuves à réunir

| Porte | Validation indépendante requise |
|---|---|
| Sauvegardes | Une sauvegarde réelle de Neon vers un S3 privé et un exercice de restauration depuis cet objet sur un PostgreSQL jetable, avec date, hash et résultat conservés hors dépôt |
| Multi-tenant | Deux comptes marchands et plusieurs boutiques/agents ; essais d'accès inter-comptes, désactivation de permissions et restauration après incident |
| Mobile et COD | Tests sur téléphones réels : panier, calcul prix/frais, commande, confirmation, expédition, suivi, annulation/retour, remise et remboursement |
| Livraison et COD | Bons de remise, documents officiels, rapprochement avec preuve bancaire réelle ; frais et remboursements contrôlés |
| Prestataires | Choisir et autoriser les prestataires logistiques, SMS/WhatsApp, et paiement. Si non connectés, maintenir l'étiquetage manuel et désactiver toute fonction se présentant comme automatique |
| Juridique/fiscal | Revue locale CGV, politique de confidentialité, droit de retour, factures, protection des données, consentements et obligations fiscales tunisiennes |
| Supervision/support | Alerte sur indisponibilités, rotation des secrets, personnel de support, procédure d'incident et test du plan de reprise |

Chaque validation doit être **documentée par le propriétaire** ou
un professionnel compétent. Les preuves contenant des informations
personnelles, bancaires ou des secrets restent dans un stockage privé
approprié et ne sont jamais collées dans une issue publique.

## Mode d'emploi

1. Exécuter les tests automatiques GitHub Actions pour le code.
2. Réaliser les recettes réelles et conserver les preuves.
3. Une fois chaque point réellement vérifié, paramétrer dans
   GitHub Actions > Variables la variable correspondante :
   `P5_BACKUP_RESTORE_VERIFIED`,
   `P5_TENANT_BOUNDARIES_VERIFIED`,
   `P5_MOBILE_COD_E2E_VERIFIED`,
   `P5_DELIVERY_COD_PROOFS_VERIFIED`,
   `P5_EXTERNAL_PROVIDER_SCOPE_VERIFIED`,
   `P5_LEGAL_FISCAL_APPROVED`,
   `P5_OBSERVABILITY_SUPPORT_READY`.
4. Exécuter manuellement le workflow `TuniCommerce P5 commercial launch go-no-go`.
5. Si le contrôle échoue, **ne pas lancer commercialement**. Une vérification
   positive ne déclenche aucun déploiement et ne remplace pas l'approbation
   humaine finale.

**Situation du 4 novembre 2026** : calendrier de snapshots Neon absent,
restauration hors site d'une vraie sauvegarde non attestée ; transporteurs,
messagerie et banque non connectés automatiquement. Les attestations ne
doivent donc pas être réglées artificiellement sur `true`.

## Ce qui reste à industrialiser

- Sauvegarde indépendante quotidienne et restauration réelle documentée.
- Health check natif Render sur `/api/health` (le blueprint inclut déjà
  cette valeur, mais le service Render existant ne la rapporte pas).
- Choix des prestataires et essais contractuels/sandbox documentés.
- Vraie recette multi-comptes et mobile par un testeur humain.
- Vérification fiscale et juridique indépendante.
- Connexion d'une IA générative (optionnelle) seulement après étude des coûts,
  des consentements et de la protection des données clients.

Consulter également `docs/priority1-offsite-backup.md` et
`docs/preparation-lancement-tunicommerce.md`.
