# Notifications e-mail — Configuration Resend

Les e-mails transactionnels (décisions, assignations, validations…) sont envoyés via **Resend**.
Tant que les clés ne sont pas renseignées, seules les notifications **in-app** fonctionnent.

Sous-domaine choisi pour l'envoi : **`mail.snb-jsan.bj`** (ne pas confondre avec la messagerie cPanel sur la racine `snb-jsan.bj`).

---

## 1. Créer le compte et la clé API

1. Compte sur [https://resend.com](https://resend.com) (plan gratuit : 1 domaine, 3 000 e-mails/mois).
2. **API Keys** → Create → copier la clé `re_…`.

## 2. Ajouter le domaine dans Resend

1. **Domains** → **Add Domain**.
2. Saisir : `mail.snb-jsan.bj`.
3. Choisir une région proche (ex. Europe si disponible).
4. Resend affiche **3 à 4 enregistrements DNS** — les recopier tels quels (ne pas utiliser d'exemples génériques).

En général :
| Type | Nom (host) | Rôle |
|------|-----------|------|
| `MX` | souvent `send` | rebonds / retours |
| `TXT` | souvent `send` | SPF |
| `TXT` | `resend._domainkey` | DKIM |
| `TXT` | `_dmarc` (optionnel) | DMARC |

## 3. DNS dans cPanel (Zone Editor)

1. cPanel → **Zone Editor** → domaine `snb-jsan.bj` → **Manage**.
2. Ajouter **chaque enregistrement** fourni par Resend.
3. Points de vigilance :
   - Si cPanel a auto-créé un **MX** ou **TXT SPF** sur `mail.snb-jsan.bj`, le remplacer par celui de Resend (un seul SPF par zone).
   - Ne pas toucher aux **MX de la racine** `snb-jsan.bj` → la messagerie cPanel reste intacte.
   - Vérifier que `mail.snb-jsan.bj` n'est pas configuré comme domaine de messagerie locale (Email Routing).
4. Resend → **Verify** (propagation : quelques minutes à quelques heures).

## 4. Variables d'environnement

Dans `jsan-webapp/.env.local` (et sur Netlify en prod) :

```bash
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=JSAN 2025 <no-reply@mail.snb-jsan.bj>
CONTACT_EMAIL=secretariat@snb-jsan.bj
NEXT_PUBLIC_APP_URL=https://votre-app.netlify.app
```

`CONTACT_EMAIL` = boîte qui reçoit les messages du formulaire de contact (défaut : `secretariat@snb-jsan.bj`).

Pas besoin de créer une vraie boîte `no-reply@mail.snb-jsan.bj` — l'expéditeur est signé par DKIM.

Redémarrer le serveur (`npm run dev`) ou redéployer sur Netlify.

## 5. Netlify + cPanel — pas de conflit si :

| Usage | Où | Impact mail cPanel |
|-------|-----|-------------------|
| Réception | `MX` sur `snb-jsan.bj` → cPanel | inchangé |
| App web | `CNAME`/`A` vers Netlify (ex. `app.snb-jsan.bj`) | aucun |
| Envoi Resend | `MX`+`TXT` sur `mail.snb-jsan.bj` | aucun |

**Ne pas** déplacer les nameservers vers Netlify sans recréer tous les enregistrements MX cPanel.

## 6. Préférences utilisateur

Chaque utilisateur peut désactiver les e-mails par catégorie dans **Mon Profil** :
`email_evenement`, `email_billetterie`, `email_messagerie`, `email_soumissions`.

## 7. Fichiers techniques

| Fichier | Rôle |
|---------|------|
| `lib/email.ts` | Envoi Resend + gabarit HTML |
| `app/api/notify/email/route.ts` | Route sécurisée (staff), prefs, service-role |
| `lib/notifications.ts` | Déclenche l'e-mail après l'in-app |

## 8. Test rapide

1. Se connecter en **organisateur**.
2. Déclencher une action notifiée (ex. valider un justificatif, décision sur un résumé).
3. Vérifier la cloche in-app **et** la boîte du destinataire.

---

*Dernière mise à jour : sous-domaine `mail.snb-jsan.bj` — à finaliser (DNS + clés).*
