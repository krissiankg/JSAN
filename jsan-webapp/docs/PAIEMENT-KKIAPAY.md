# Paiement Kkiapay — Guide de configuration

La billetterie JSAN encaisse les paiements via **Kkiapay**. Deux modes coexistent :

| Mode | Quand | Confirmation |
|------|-------|--------------|
| **Automatique** (recommandé) | Clés Kkiapay renseignées | Le billet passe à « Payé » tout seul, après vérification serveur |
| **Manuel** (repli) | Clés absentes | L'organisateur confirme chaque transaction dans _Admin › Paiements_ |

Tant que les clés ne sont pas remplies, le site reste en mode manuel — rien n'est cassé.

---

## 1. Récupérer les clés dans Kkiapay

1. Se connecter sur [https://app.kkiapay.me](https://app.kkiapay.me).
2. Menu **Développeurs / API Keys**.
3. Noter les trois valeurs :
   - **Clé publique** (`public key`) — utilisée par le widget dans le navigateur.
   - **Clé privée** (`private key`) — serveur uniquement.
   - **Secret** (`secret`) — serveur uniquement + signature du webhook.

> Astuce : gardez d'abord les clés **Sandbox** (test) pour valider le flux sans argent réel, puis basculez en clés **Production**.

## 2. Renseigner les variables d'environnement

Dans `jsan-webapp/.env.local` (jamais committé) :

```bash
NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY=<clé publique>
KKIAPAY_PRIVATE_KEY=<clé privée>
KKIAPAY_SECRET=<secret>
NEXT_PUBLIC_KKIAPAY_SANDBOX=true   # false quand vous passez en production
```

Redémarrer le serveur (`npm run dev`, ou redéployer) pour prendre en compte les variables.

## 3. Configurer le webhook dans Kkiapay

1. Aller dans _Admin › Paiements_ de l'application : la carte de statut affiche l'**URL de webhook** exacte (ex. `https://votre-domaine/api/kkiapay/webhook`).
2. Dans le tableau de bord Kkiapay, coller cette URL dans le champ **Webhook / Callback URL**.

Le webhook est le filet de sécurité : même si le participant ferme son navigateur juste après avoir payé, Kkiapay notifie le serveur et le billet est réglé.

## 4. Vérifier que tout fonctionne

- _Admin › Paiements_ doit afficher **« Confirmation automatique active »** (badge SANDBOX ou PRODUCTION).
- Acheter un billet de test depuis la **Boutique** : le widget Kkiapay s'ouvre, on paie, puis le billet passe à **« Payé »** dans _Mes billets_ sans intervention.

---

## Comment ça marche (technique)

```
Navigateur                       Serveur JSAN                    Kkiapay
   │  clic « Acheter »               │                              │
   │  crée billet En_Attente ───────►│ (Supabase)                   │
   │  openKkiapayWidget(data=id) ───────────────────────────────►  │  paiement
   │  ◄── transactionId ────────────────────────────────────────  │
   │  POST /api/kkiapay/confirm ────►│  verifyKkiapayTransaction ─► │  (SUCCESS ?)
   │                                 │  ◄── SUCCESS + montant ───── │
   │                                 │  billet → Payé (service-role)│
   │                                 │◄── webhook (filet secours) ─ │
```

Fichiers clés :

| Fichier | Rôle |
|---------|------|
| `lib/kkiapay.ts` | Vérification transaction + config (clés, sandbox) |
| `lib/kkiapay-settle.ts` | Contrôle montant + passage à « Payé » (idempotent) |
| `lib/supabase/admin.ts` | Client service-role (contourne la RLS, serveur seul) |
| `app/api/kkiapay/confirm/route.ts` | Callback du widget (navigateur) |
| `app/api/kkiapay/webhook/route.ts` | Notification serveur-à-serveur (protégée par le secret) |
| `app/dashboard/billetterie/page.tsx` | Ouverture du widget + repli lien statique |
| `app/dashboard/admin/paiements/page.tsx` | Statut, URL webhook, liens de repli, confirmation manuelle |

### Sécurité

- Un billet ne peut **jamais** être marqué « Payé » depuis le navigateur : seul le serveur le fait, après avoir vérifié la transaction auprès de Kkiapay.
- Le webhook rejette tout appel dont le header `x-kkiapay-secret` ne correspond pas à `KKIAPAY_SECRET`.
- Le montant payé est comparé au prix du billet avant validation.
- `transaction_id_kkiapay` est unique → rejouer une notification ne crée pas de doublon.
