# TuniCommerce — Contrôle léger de disponibilité (P1)

Le workflow GitHub Actions `priority1-render-health-monitor.yml` vérifie **quatre fois par jour**, à 01h17, 07h17, 13h17 et 19h17 UTC, le point public `https://tunicommerce-test.onrender.com/api/health`.

L'endpoint existe déjà dans TuniCommerce et effectue un `SELECT 1` sur sa base PostgreSQL : un code 200 et `{"server":"ok","database":"ok"}` sont requis. Les réponses 503, erreurs réseau et réponses non conformes échouent. Le script réessaie jusqu'à 7 fois, car les instances Render gratuites peuvent démarrer à froid.

Le test ne consulte aucun compte marchand, n'expose aucun secret, ne déclenche aucune commande et ne change aucune donnée. Une exécution en échec est visible dans l'onglet GitHub Actions ; les notifications automatiques dépendent des réglages du compte GitHub. Une vérification GitHub planifiée peut être retardée par le fournisseur.

**Limites :** ce n'est ni une sonde 24/7 ni un contrôle de la qualité métier. Une réponse saine ne prouve pas que les boutiques, appels, paiements ou restaurations sont opérationnels. Le chemin de health check de Render reste vide dans la configuration actuelle du service et doit être défini séparément si l'on souhaite que Render conditionne les déploiements à ce contrôle. Ce workflow ne modifie pas la configuration Render ni la facturation.

## Smoke de sécurité sur le service Live

Le même workflow exécute `scripts/priority1-public-security-smoke.mjs` après la disponibilité :
GET anonyme `/api/commerce` et `/api/admin/subscriptions/export` doivent répondre 401 ;
`/admin` doit rediriger vers `/login` (même origine HTTPS). Aucune session
utilisateur, commande ou donnée privée n'est employée. Cette surveillance
complète les tests HTTP sur PostgreSQL jetable, mais ne remplace pas une recette
connectée avec des comptes de démonstration distincts.

## Durcissement P1

- Surveillance anonyme read-only élargie aux trois API privées de boutique : commandes, export transport et export audit COD. Le contrôle doit échouer si une de ces API devient accessible sans session.
- En-têtes `Cache-Control: private, no-store` et `X-Robots-Tag` appliqués aussi aux nouvelles routes de suivi privé et aux API marchandes.
- Ces tests ne constituent pas des tests métiers authentifiés et ne remplacent pas des alertes externes 24/7.

## P1 — Vérification des nouvelles pages d'administration

Le contrôle de sécurité anonyme vérifie maintenant également `/admin/lancement`, `/admin/fiabilite` et `/admin/integrations`, qui doivent toutes rediriger vers `/login` sans cookie ni session. Le nombre de points d'accès vérifiés passe de six à neuf. Les vérifications ne lisent aucun secret, ne consultent aucun compte marchand et n'altèrent aucune commande. Ce contrôle valide uniquement la barrière aux visiteurs anonymes ; l'autorisation des rôles est vérifiée séparément dans les tests multi-boutiques.
