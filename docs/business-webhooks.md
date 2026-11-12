# Événements externes signés de boutique

Le parcours **Mes boutiques → Connecter mes outils et suivre les événements** prépare une destination HTTPS pour les événements ORDER_CREATED et ORDER_STATUS_CHANGED. Il couvre les boutiques indépendantes et les commerces historiques liés à un Workspace. Il est désactivé par défaut et ne raccorde aucun transporteur, banque, prestataire de paiement, SMS ou WhatsApp.

## Configuration explicite

L'exploitant configure la même APP_ENCRYPTION_SECRET sur le web et le worker, puis WEBHOOK_ALLOWED_HOSTS avec les hôtes DNS exacts autorisés, séparés par des virgules. La liste vide empêche les envois. Un domaine autorisé n'autorise pas ses sous-domaines ni un nom qui le contient simplement. Ne pas copier des secrets ou URL privées dans Git, les journaux, les tickets ou les conversations.

Le véritable propriétaire, avec adhésion OWNER active et adresse de compte vérifiée, enregistre sa destination, crée une clé, configure le récepteur puis active explicitement les échanges. La préparation d'une adresse non vide ou la création d'une clé exige déjà le chiffrement. La destination et la clé sont conservées dans des enveloppes AES-GCM distinctes, liées à la boutique. La clé n'est affichée qu'à sa création/rotation, dans une réponse privée sans cache ni referrer ; elle ne revient jamais dans un GET. Le récepteur doit la conserver dans son propre gestionnaire de secrets.

Toute modification des réglages annule les tâches encore en attente. Renouveler la clé désactive également les envois jusqu'à une nouvelle activation. Un envoi déjà engagé peut aboutir ; les relances et la déduplication doivent en tenir compte. Les réglages sont liés à l'identité du propriétaire qui les a créés. Une nouvelle propriété de l'organisation n'hérite ni d'une destination active ni d'une clé précédente, et les anciens événements ne peuvent pas être relancés par le nouveau propriétaire.

L'API privée `/api/v1/shops/<shopId>/webhook` utilise une version attendue et refuse les origines étrangères, les rôles de collaborateur ou de faux OWNER d'une autre organisation. Une session d'administration globale ne donne pas d'accès marchand implicite. Le journal montre les trente derniers événements du propriétaire actif, sans clés, enveloppes, contenus bruts ou réponse du prestataire.

## Contrat des événements

Exemple fictif du corps JSON :

```json
{
 "id": "00000000-0000-4000-8000-000000000001",
 "type": "ORDER_CREATED",
 "occurredAt": "2026-11-12T12:00:00.000Z",
 "shopId": "00000000-0000-4000-8000-000000000002",
 "data": {
  "orderId": "00000000-0000-4000-8000-000000000003",
  "reference": "TC-EXEMPLE",
  "status": "TO_CONFIRM",
  "totalMillimes": 59000,
  "currency": "TND",
  "commerceVersion": 4
 }
}
```

Le nom, téléphone, adresse et identifiant client, les lignes d'articles, coûts, notes et liens confidentiels de suivi ne sont pas exportés. L'état est celui enregistré dans Tunicom à la date de l'événement. Une signature authentifie cet événement de la plateforme ; elle ne certifie ni livraison réelle par un transporteur ni encaissement bancaire. Une réponse du récepteur ne modifie jamais les stocks, le COD ou les abonnements.

Les en-têtes sont X-Tunicom-Event, X-Tunicom-Delivery et X-Tunicom-Signature. La signature a le format `t=SECONDES_UNIX,v1=HMAC_HEXADECIMAL`. Elle est calculée avec HMAC-SHA256 sur les octets de `SECONDES_UNIX` suivis d'un point puis du corps brut UTF-8, en utilisant la clé fournie comme chaîne UTF-8. Le récepteur doit limiter le corps à 16 ko, vérifier cette signature en temps constant et accepter un décalage d'horloge d'au plus cinq minutes avant de traiter le JSON. Le module `webhook-signature.ts` fournit une implémentation Node pour cette vérification.

Les événements peuvent arriver plusieurs fois ou dans un ordre différent. Le récepteur doit conserver une clé unique persistante sur id et traiter la réception atomiquement. Il doit comparer commerceVersion **par commande**, afin qu'un événement ancien ne remplace pas un état plus récent d'une même commande. Il ne doit pas utiliser un compteur global de boutique pour supprimer les événements d'autres commandes. Retourner un 2xx après réception durable, y compris pour un doublon déjà enregistré. Un acquittement HTTP signifie seulement que la destination accepte l'événement, pas que son opération métier est achevée.

## File durable, reprises et limites

Les quatre voies principales de mutation (marchand et checkout public, historiques et indépendants) enregistrent l'événement chiffré et sa tâche dans la même transaction que la commande. Un rollback ne laisse ni événement, tâche ni budget consommé. Rejouer un requestId ou un checkout existant ne duplique pas l'événement. Une modification de note seule n'en crée pas.

Le worker recontrôle le propriétaire, l'adhésion active, l'adresse vérifiée, l'activation, la version de destination, la politique d'hôtes et la validité du contenu avant chaque tentative. Une perte de chiffrement, une limite quotidienne ou un réglage invalide ne doit pas empêcher de sauvegarder la commande : l'événement est signalé indisponible ou non mis en file, avec diagnostic limité. Aucun contenu non chiffré n'est stocké pour contourner cette indisponibilité.

Chaque traitement autorise quatre tentatives, avec délais croissants. Les erreurs réseau et HTTP 408, 425, 429 ou 5xx sont réessayées ; les redirections et autres erreurs 3xx/4xx sont terminales. Le journal permet de relancer un échec ou une annulation, pendant 48 heures, au plus cinq traitements par événement. Une requestId de relance répétée reste idempotente. Une relance conserve les octets et l'identifiant de l'événement, mais crée un nouvel identifiant de traitement. Les reprises automatiques conservent cet identifiant de traitement. Une tâche déjà acceptée ou en cours ne se relance pas par un nouveau bouton.

La limite est de 1 000 demandes de traitement par boutique et jour UTC, initialisations et relances comprises ; les quatre tentatives automatiques d'une même demande partagent cette réservation. Les événements au-delà de cette limite ne sont pas mis en file, un compteur et la date du dernier abandon sont visibles, et la commande reste enregistrée. Ce compteur n'est pas une preuve d'envoi. Les métadonnées et corps d'événements sont éligibles au nettoyage après trente jours, par lots bornés ; voir `worker-operations.md`.

## Réseau et recette

Le transport impose HTTPS sur 443, sans identifiant dans l'URL, paramètre de requête, fragment, port personnalisé ou adresse IP littérale. Il ne suit aucune redirection. Il résout les adresses IPv4 de l'hôte autorisé, refuse les plages privées/spéciales et toute réponse DNS mixte incluant une adresse refusée, puis se connecte à une adresse validée fixe. Le nom HTTP/TLS reste celui du destinataire et les certificats sont vérifiés. Il n'utilise ni proxy hérité ni pool de sockets ; les destinations uniquement IPv6 ne sont pas prises en charge dans cette version.

Les délais sont bornés (résolution de cinq secondes au plus, requête de quinze secondes au plus, inactivité de cinq secondes), les en-têtes de réponse à 8 ko et le corps de réponse à 64 ko, sans conservation. Les erreurs et réponses du service ne sont pas journalisées en clair. Ces choix s'appuient sur la [documentation HTTPS de Node 24](https://nodejs.org/download/release/v24.18.0/docs/api/https.html), sa [résolution DNS](https://nodejs.org/docs/latest-v24.x/api/dns.html), le [registre IPv4 spécial de l'IANA](https://www.iana.org/assignments/iana-ipv4-special-registry/) et le [mécanisme HMAC de la RFC 2104](https://www.rfc-editor.org/rfc/rfc2104.html).

Les tests emploient uniquement des boutiques fictives, une fonction d'envoi injectée et un transport HTTPS simulé ; aucune requête vers un destinataire réel n'est envoyée. Ils ne constituent pas une recette de certificat ou de compatibilité d'un prestataire réel. Sur le futur VPS, préparer un récepteur de recette autorisé, vérifier la signature, la réception durable, les doublons et l'ordre inversé, puis la révocation et la rotation avant activation commerciale. Les adaptateurs transporteur/paiement/SMS propres à leurs contrats restent à développer séparément.
