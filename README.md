# Cassetta

Pianifichi la settimana, la lista della spesa esce da sola, e sai in quale supermercato conviene andare.

Progetto personale, utente singolo. Convenzioni, comandi e regole di design stanno in `CLAUDE.md`; il piano di lavoro in `ROADMAP.md`.

## Partire da zero

```bash
pnpm install
cp .env.example .env     # metti dentro DATABASE_URL
pnpm db:migrate
pnpm --filter @cassetta/db seed
pnpm dev
```

## Struttura

```
apps/web       Next.js 15, App Router
apps/worker    worker Python, gira a cron su Railway
packages/db    schema Drizzle e migrazioni
```
