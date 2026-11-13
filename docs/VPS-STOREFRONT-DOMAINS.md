# Adresses des boutiques sur VPS

Le code est prêt à être configuré ; aucun domaine, serveur VPS ou certificat réel n'est provisionné par cette livraison. Render reste un environnement de test avec `STOREFRONT_DOMAIN_ROUTING=disabled`.

## Modèle

L'administration reste sur `APP_URL`. Une boutique indépendante publiée peut utiliser `<slug>.<STOREFRONT_ROOT_DOMAIN>` et jusqu'à cinq domaines personnels. Le propriétaire utilise `/mes-boutiques/<shopId>/domaines` ; les membres et les autres propriétaires n'y accèdent pas.

Une demande `ShopDomainClaim` génère un code aléatoire, valable sept jours tant qu'il n'est pas vérifié. Le marchand crée le TXT `_tunicom-verification.<domaine>` avec la valeur affichée puis demande la vérification. Les fragments TXT sont réunis avant comparaison exacte. Une demande en attente ne réserve pas le domaine ; seule une preuve réussie crée un `ShopDomainBinding`, unique sur toute la plateforme. Retirer la demande supprime aussi la liaison sans supprimer la boutique.

La preuve TXT confirme la propriété. Elle ne confirme ni le pointage A/AAAA/CNAME, ni un certificat HTTPS. Conserver le TXT après validation. Quand le routage est activé, le worker revérifie les liaisons chaque jour, par lots de cinq avec des baux de 90 secondes. Les recherches DNS se font hors transaction et les réponses devenues obsolètes sont écartées.

Un TXT absent ou différent suspend la liaison ; une panne DNS conserve la dernière preuve sans prolonger sa validité et entraîne une nouvelle tentative après une heure. Au bout de 72 heures sans preuve valide, les requêtes et l'autorisation de certificat sont refusées, même si le worker est arrêté. Les sous-domaines automatiques gérés par la plateforme ne dépendent pas de ces TXT personnels. Une vérification manuelle réussie rétablit la liaison.

Chaque demande et liaison mémorise le propriétaire qui a fourni la preuve. Après un changement de propriétaire de l'organisation, l'ancien code est masqué, la liaison refusée et le nouveau propriétaire doit renouveler le code, modifier le TXT puis vérifier. La migration initialise les anciens enregistrements avec le propriétaire actuel : elle ne reconstitue pas l'historique des transferts antérieurs. Une liaison historique dont la preuve a plus de 72 heures exige une nouvelle vérification. Les déclencheurs SQL initialisent les insertions des anciennes instances pendant le déploiement sans réécrire une preuve existante lors d'une modification.

L'écran Domaines affiche l'état, la dernière preuve valide et le dernier contrôle. « Actualiser l'état » conserve le domaine en cours de saisie. Un transfert entre deux boutiques distinctes exige encore le retrait de la liaison précédente ; il n'existe pas de transfert automatique entre boutiques.

## Préparer le serveur

1. Sauvegarder PostgreSQL, vérifier une restauration sur une base séparée et appliquer les migrations additives avec `npm run db:migrate`.
2. Définir `APP_URL=https://plateforme.exemple.tn`, `STOREFRONT_ROOT_DOMAIN=boutiques.exemple.tn`, `STOREFRONT_DOMAIN_ROUTING=enabled`, `BIND_HOST=127.0.0.1` et `PORT=3000`. Les noms ici sont des exemples, à remplacer. Garder les secrets dans l'environnement du service.
3. Exposer seulement le reverse proxy HTTPS sur 80/443. Le port Node 3000 et PostgreSQL ne doivent pas être accessibles depuis Internet. Ne pas activer `experimental.trustHostHeader` dans Next.js. Le proxy doit conserver le véritable `Host`, sans accepter un hôte fourni par `X-Forwarded-Host`.
4. Faire pointer le domaine de la plateforme et `*.boutiques.exemple.tn` vers le VPS. Pour chaque domaine personnel, ajouter les A/AAAA vers le VPS, ou un CNAME pour un sous-domaine. Ne publier un AAAA que si IPv6 fonctionne réellement. Les domaines racines dépendent des possibilités DNS du registrar.
5. Configurer un reverse proxy avec émission TLS à la demande contrôlée. Avec Caddy, l'option globale `on_demand_tls` doit appeler `http://127.0.0.1:3000/api/v1/public/domains/allow` via `ask`, et le site HTTPS dynamique doit activer `tls { on_demand }`. Utiliser un bloc explicite pour le domaine de la plateforme. Valider la configuration avec `caddy validate` avant rechargement. Ne jamais activer l'émission à la demande sans cette autorisation.

L'endpoint `allow?domain=<nom>` renvoie 200 seulement pour une boutique initialisée, indépendante, publiée et dont l'abonnement est actif et non expiré, avec un sous-domaine autorisé ou une liaison vérifiée. Un refus renvoie 403 ; une panne renvoie 503. Cette réponse autorise Caddy à demander un certificat, elle ne prouve pas qu'un certificat a été émis. Configurer aussi la protection et les limites du reverse proxy et respecter les limites de l'autorité de certification.

`DOMAIN_DNS_SERVERS` est facultatif : liste de résolveurs DNS de confiance séparés par des virgules. Sans valeur, les résolveurs du système sont utilisés. Ce paramètre est réservé à l'exploitant, jamais fourni par un marchand.

Le web et le worker doivent partager les paramètres de routage et la base ; lancer et superviser le worker même sans SMTP. Sans worker actif, les preuves personnelles finissent par expirer. Sur Render de test, le routage reste désactivé et aucune revérification DNS automatique n'est lancée.

## Validation avant ouverture réelle

Tester un sous-domaine et un domaine personnel contrôlés : DNS public, HTTPS valide, catalogue, fiche produit, panier, commande COD, suivi et demande client. Vérifier les refus sur `/admin`, `/mes-boutiques`, les API privées et les chemins d'une autre boutique, même avec une session valide. Tester retrait du domaine, dépublication et suspension. Sur un domaine boutique, seules les routes publiques de sa boutique sont permises ; les liens historiques propres à la boutique redirigent vers les chemins courts.

Les essais locaux couvrent ces parcours avec PostgreSQL, un vrai serveur DNS TXT local et le serveur Next de production. Ils ne remplacent pas les essais DNS/TLS du futur VPS. Aucune clé de paiement, aucun e-mail ni aucun SMS réel n'est envoyé par ces tests.

Références : [DNS Node.js](https://nodejs.org/api/dns.html), [HTTPS automatique Caddy](https://caddyserver.com/docs/automatic-https), [options globales Caddy](https://caddyserver.com/docs/caddyfile/options).
