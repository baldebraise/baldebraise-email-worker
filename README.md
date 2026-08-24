# 🔥 BalDeBraise Email Relay — Cloudflare Email Worker

Passerelle de messagerie bidirectionnelle intelligente pour **Compagnie BalDeBraise**.

Ce Worker Cloudflare permet de répondre aux demandes de devis et clients **directement depuis votre compte Gmail personnel** (`ciebaldebraise@gmail.com`), tout en garantissant :
1. **L'expéditeur officiel** : `compagnie@baldebraise.com`
2. **Une mise en page VIP automatique** : Template sombre luxueux avec le logo officiel BalDeBraise, vos coordonnées directes et le badge de conformité / sécurité spectacle.
3. **Une boucle de discussion continue** : Si le client répond, son message revient directement dans votre fil de discussion Gmail.

---

## 🚀 Déploiement sur Cloudflare

### Option A : Déploiement automatique via GitHub (Recommandé)
1. Connectez-vous sur votre tableau de bord **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Allez dans **Compute (Workers & Pages)** ➔ **Create application** ➔ **Workers**.
3. Liez ce dépôt GitHub (`baldebraise-email-worker`) pour bénéficier du déploiement continu automatique à chaque modification !

### Option B : Déploiement via Wrangler CLI
```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

---

## 📬 Configuration de l'Email Routing sur Cloudflare

1. Dans Cloudflare, ouvrez votre domaine **`baldebraise.com`**.
2. Allez dans **Email** ➔ **Email Routing** ➔ **Routing Rules**.
3. Créez / modifiez la règle :
   - **Custom address** : `Catch-all` (ou `compagnie@baldebraise.com` et `relais@baldebraise.com`)
   - **Action** : `Send to Worker` ➔ `baldebraise-email-relay`
4. Cliquez sur **Save**.

---

© 2026 Compagnie BalDeBraise • Tous droits réservés.
