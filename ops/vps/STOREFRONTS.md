# Adresses de boutique

Le code et l'infrastructure s'activent séparément. Le déploiement du code ne
modifie pas le proxy commun ni ses variables privées.

## Activation opérateur

- DNS : `A * → 187.126.31.110` dans la zone actuelle de tunicom.shop. Conserver
  les autres enregistrements (notamment e-mail). L'IP est propre à ce VPS.
- `/etc/tunicom/platform.env` : `STOREFRONT_DOMAIN_ROUTING=enabled` et
  `STOREFRONT_ROOT_DOMAIN=tunicom.shop`, puis recréer uniquement web/worker avec
  les images déjà validées. La base et le proxy Fixi ne sont pas recréés.
- Le Caddy commun conserve les sites explicites `fixiphone.io` et `tunicom.shop`,
  ajoute l'autorisation TLS via un listener **interne** `127.0.0.1:9080`,
  puis un site `https://` avec `tls { on_demand }`. L'URL `ask` est
  `http://127.0.0.1:9080/api/v1/public/domains/allow`. Son reverse proxy doit
  transmettre `Host: tunicom.shop` vers `tunicom-production-web:3000`.
- Activer `strict_sni_host on`, conserver le filtre de logs, les volumes de
  certificats existants et les trois réseaux séparés. Ne publier ni 9080 ni
  2019. Valider une copie du Caddyfile dans un conteneur isolé avant reload.
- Le Caddyfile est monté par fichier : le modifier en conservant son inode
  pour qu'un `caddy reload` voie le nouveau contenu. Sauvegarder sa version
  précédente et le fichier d'environnement privé avant toute activation.

L'autorisation TLS accepte seulement une boutique publique avec abonnement
valide, par sous-domaine automatique ou domaine personnel dont le propriétaire
a une preuve TXT récente. Elle refuse les noms réservés, inconnus, suspendus,
non publiés, transférés sans nouvelle preuve, ou dont le TXT est révoqué/périmé.
Un certificat déjà en cache ne donne aucun droit : la publication et la preuve
sont vérifiées à chaque requête. Si le routage est désactivé, les anciens
domaines de boutique ne peuvent pas exposer les routes de la plateforme.
La sonde interne `/api/health` reste accessible en loopback.

## Parcours marchand

Une boutique publiée reçoit `nom-boutique.tunicom.shop`. Les anciennes adresses
`/boutiques/slug` et `/vitrines/slug` restent utilisables. L'ancien préfixe
singulier `/boutique/slug` redirige seulement vers une boutique publique.
Les espaces historiques sans import relationnel conservent leurs données et
peuvent aussi utiliser leur sous-domaine ; aucune importation forcée n'a lieu.

Dans **Ma boutique → Domaines** :

1. Acheter un domaine auprès du fournisseur de son choix, puis ajouter son nom
   exact (par exemple `ma-boutique.com`, séparément de `www.ma-boutique.com`).
2. Configurer le pointage A du nom principal vers l'IPv4 affichée, ou le CNAME
   d'un sous-domaine vers l'hôte de plateforme affiché. Ces instructions ne
   modifient pas automatiquement la zone DNS du marchand.
3. Ajouter le TXT de propriété généré pour cette boutique et le vérifier.
4. Ouvrir HTTPS sur le domaine pour vérifier son pointage et son certificat.
   Une preuve TXT seule ne garantit pas ces deux conditions.
5. Choisir explicitement **Définir comme adresse principale**. L'adresse Tunicom
   redirige alors les lectures des pages publiques vers ce domaine. Les POST,
   médias et routes privées ne sont pas redirigés vers une autre origine.

Le propriétaire peut revenir à son adresse Tunicom. Un seul domaine personnel
par boutique peut être choisi à la fois (contrainte unique partielle PostgreSQL
et verrou de boutique). Une preuve expirée/révoquée ou un changement de
propriétaire retire immédiatement la cible des adresses préférées ; le lien
automatique reprend la priorité. Les redirections vers un domaine choisi sont
temporaires et `no-store` pour éviter de conserver une cible révoquée.

## Capacité des certificats

Cette activation utilise des certificats individuels à la demande, avec contrôle
d'autorisation. Elle ne provisionne pas de certificat wildcard DNS-01. Avant une
forte croissance des inscriptions, prévoir les limites du fournisseur ACME et
une stratégie wildcard/DNS-01 pour les sous-domaines Tunicom. Les domaines
personnels conservent leur vérification de propriété indépendante.

Sources : [Caddy On-Demand TLS](https://caddyserver.com/docs/automatic-https#on-demand-tls),
[limites ACME](https://letsencrypt.org/docs/rate-limits/).
