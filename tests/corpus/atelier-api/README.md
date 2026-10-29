# atelier-api

Réservation d'ateliers créatifs : on choisit un créneau, on paie, on reçoit un email.

- **API** Express (`src/`), Postgres avec Drizzle, Redis pour la file d'emails.
- **Worker** d'emails (`src/email/main.ts`), BullMQ ; Resend en production.
- **App web** React (`web/`).
- Paiements par **Stripe**.

## Démarrer

```bash
cp .env.example .env
docker compose up -d postgres redis
pnpm install
pnpm db:migrate
pnpm dev        # API sur :3000
pnpm worker     # emails
pnpm web        # app sur :5173
```

## Règles métier

- Une réservation non payée est libérée après **15 minutes**.
- Un client n'a qu'une réservation active par créneau.
- Un double clic sur « Payer » ne débite jamais deux fois.
- Les emails partent par la file : une panne du fournisseur ne bloque pas la réservation.

## Déploiement

Fly.io (`fly.toml`) : l'API sur deux machines, le worker à part.

---

> Projet d'exemple du corpus de test de VisionLayer. Les cas qu'il contient sont listés dans `expected.json`.
