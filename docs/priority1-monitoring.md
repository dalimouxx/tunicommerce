# TuniCommerce — Contrôle léger de disponibilité (P1)

Le workflow GitHub Actions `priority1-render-health-monitor.yml` vérifie **deux fois par jour**, à 07h17 et 19h17 UTC, le point public `https://tunicommerce-test.onrender.com/api/health`.

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
