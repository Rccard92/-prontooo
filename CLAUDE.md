# Cassetta

Webapp personale di pianificazione pasti, lista della spesa e confronto offerte dei supermercati. Utente singolo, uso privato, non commerciale.

La roadmap completa è in `ROADMAP.md`. Leggila prima di iniziare una fase nuova.

## Architettura

Monorepo pnpm, due servizi Railway, un Postgres condiviso.

```
apps/web      Next.js 15 App Router, TypeScript, Tailwind v4
apps/worker   Python 3.12, ingestion ricette e volantini, cron settimanale
packages/db   Schema Drizzle e migrazioni, condiviso
```

Il worker non espone HTTP pubblico: legge fonti esterne e scrive su Postgres. `packages/db` viene consumato come sorgente TypeScript (`transpilePackages`), non ha un passo di build.

## Comandi

```bash
pnpm install                       # una volta, alla radice
pnpm dev                           # web in locale su :3000
pnpm build                         # build di produzione del web
pnpm typecheck                     # tsc su tutti i pacchetti

pnpm db:generate                   # genera migrazione dopo modifica schema
pnpm db:migrate                    # applica migrazioni
pnpm db:studio                     # ispeziona il database
pnpm --filter @cassetta/db seed    # popola l'elenco allergeni, idempotente

cd apps/worker && uv run python main.py   # worker in locale
```

Il `.env` sta alla radice del monorepo, non dentro i pacchetti. Vedi `.env.example`.
Per lavorare in locale contro il Postgres di Railway usa `DATABASE_PUBLIC_URL` (variabile del servizio `postgres`) come `DATABASE_URL`.

## Deploy

Railway, progetto `cassetta`, ambiente `production`. Tre servizi:

| Servizio | Cos'è | Come si costruisce |
|---|---|---|
| `postgres` | Postgres 17 con volume su `/var/lib/postgresql/data` | immagine `ghcr.io/railwayapp-templates/postgres-ssl:17` |
| `web` | Next.js | Nixpacks dalla radice del repo, pre-deploy `db:migrate` + `seed` |
| `worker` | Python | Dockerfile in `apps/worker`, cron settimanale |

Push su `main` → Railway ricostruisce e sostituisce il deploy. Nessun passaggio manuale.
Le migrazioni girano come pre-deploy del `web`: se falliscono, il deploy vecchio resta in piedi.

## Regole di lavoro

- Ogni fase della roadmap finisce deployata e funzionante prima che inizi la successiva
- Migrazioni Drizzle sempre generate, mai SQL scritto a mano
- Le chiamate LLM per la normalizzazione girano una volta per ricetta e il risultato si salva: non normalizzare a runtime
- Niente segreti nel repo, tutto in variabili Railway
- Il parser ricette va sempre testato su un URL reale prima di dichiararlo finito

## Regole di dominio

- **Gli allergeni si derivano dagli ingredienti canonici, mai dai tag della fonte.** Un sito che dichiara "senza glutine" non è attendibile
- Le esclusioni per allergia sono rigide e non aggirabili dal suggeritore. Le esclusioni per preferenza sono morbide
- La lista della spesa è **derivata** dal piano, non è un'entità salvata. Cambia il piano, cambia la lista
- Un match offerta ↔ ingrediente sotto soglia di confidenza si mostra come "da verificare", mai come certo
- Conad varia per cooperativa regionale e punto vendita: va usato sempre il volantino del punto vendita configurato

## Design

Direzione scelta: **A, etichetta d'agrumi** (`ROADMAP.md`, sezione 5). Da rispettare alla lettera.

I token stanno in `apps/web/app/globals.css`, dentro `@theme`. La palette di default di Tailwind è azzerata con `--color-*: initial`: `slate`, `zinc` e `gray` non sono raggiungibili nemmeno per sbaglio, e lo stesso vale per i font.

```
inchiostro  #14213D   fondo profondo, testo
cobalto     #1B4BA8   superfici, sezioni
zagara      #F2C230   accento primario, prezzi, azioni
foglia      #2E6B3E   conferme, stagionalità
carta       #FAF6EC   fondo chiaro
sangue      #C3352B   scadenze, allergeni, avvisi
```

`font-display` è Yeseva One, `font-testo` è Archivo con cifre tabulari. Le utility `cornice` e `cornice-interna` fanno il doppio filetto dell'etichetta: è l'unico elemento ripetibile del sistema.

Vietato in tutta l'app:

- font Inter
- palette `slate` / `zinc` / `gray` di Tailwind
- card identiche con bordo 1px grigio, `rounded-lg` e `shadow-sm`
- etichette in maiuscoletto spaziato sopra i titoli
- emoji al posto delle icone
- `→` nel testo dei pulsanti
- transizioni hover su ogni elemento

Prima di scrivere CSS per una schermata nuova: piano compatto di colore, tipografia e layout, poi verifica che non sia quello che verrebbe fuori per qualsiasi altra app di ricette.

Librerie previste quando servono (non installate finché non servono): Base UI o Radix vestiti a mano, Motion per l'unico momento animato, Embla, Phosphor Icons, Vaul, NumberFlow. Non il kit shadcn di default, non Lucide.

## Copy

Italiano, tono diretto, frasi brevi. I pulsanti dicono cosa succede ("Salva il piano", non "Conferma"). Gli stati vuoti dicono cosa fare, non si scusano.

## Stato

Fase 0 chiusa: repo, Postgres con volume, web e worker in produzione, deploy automatico su push, migrazioni al deploy.
Prossima: Fase 1, catalogo ricette.
