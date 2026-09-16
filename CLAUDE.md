# èProntooo

Webapp personale di pianificazione pasti, lista della spesa e confronto offerte dei supermercati. Utente singolo, uso privato, non commerciale.

La roadmap completa è in `ROADMAP.md`. Leggila prima di iniziare una fase nuova.

## Architettura

Monorepo pnpm, due servizi Railway, un Postgres condiviso.

```
apps/web      Next.js 15 App Router, TypeScript, Tailwind v4
apps/worker   Python 3.12, raccolta ricette dalle sitemap e volantini, gira sempre
packages/db   Schema Drizzle e migrazioni, condiviso
```

Il worker non espone HTTP pubblico: legge fonti esterne e scrive su Postgres.
Il parser JSON-LD sta in TypeScript dentro il web (`apps/web/lib/ricette`): l'import da URL deve rispondere subito, e un servizio a cron non puo' farlo.

Il worker decide **quali** ricette raccogliere - legge le sitemap delle fonti, scarta quelle gia' in catalogo - e passa un indirizzo alla volta a `POST /api/interno/importa`, che e' l'unico posto dove vive il parser. La rotta e' chiusa da `SEGRETO_INTERNO` e il worker la chiama sulla rete privata di Railway (`URL_WEB_INTERNO`). Le fonti stanno in `apps/worker/fonti.py`. `packages/db` viene consumato come sorgente TypeScript (`transpilePackages`), non ha un passo di build.

## Comandi

```bash
pnpm install                       # una volta, alla radice
pnpm dev                           # web in locale su :3000
pnpm build                         # build di produzione del web
pnpm typecheck                     # tsc su tutti i pacchetti
pnpm test                          # test del parser ricette

pnpm db:generate                   # genera migrazione dopo modifica schema
pnpm db:migrate                    # applica migrazioni
pnpm db:studio                     # ispeziona il database
pnpm seed                          # allergeni e vocabolario alimenti, idempotente

cd apps/worker && uv run python main.py   # worker in locale
```

Il `.env` sta alla radice del monorepo, non dentro i pacchetti. Vedi `.env.example`.
Per lavorare in locale contro il Postgres di Railway usa `DATABASE_PUBLIC_URL` (variabile del servizio `postgres`) come `DATABASE_URL`.

## Deploy

Railway, progetto `èProntooo`, ambiente `production`. Tre servizi:

| Servizio | Cos'è | Come si costruisce |
|---|---|---|
| `postgres` | Postgres 17 con volume su `/var/lib/postgresql/data` | immagine `ghcr.io/railwayapp-templates/postgres-ssl:17` |
| `web` | Next.js | Nixpacks dalla radice del repo, pre-deploy `db:migrate` + `seed` |
| `worker` | Python | Dockerfile in `apps/worker`, processo sempre attivo |

Il worker **non** usa il cron di Railway: ha un ciclo suo che dorme `INTERVALLO_SECONDI` fra un giro e l'altro. Non è una scelta estetica. Un servizio a cron con `restart NEVER` viene creato ma non avviato finché non scatta l'orario, e se l'orario è l'unica leva non c'è modo di far partire un giro adesso: si aspetta e basta. Un processo che dorme parte al deploy, si vede nei log, e un redeploy lo forza.

Quando il catalogo ha raggiunto `CATALOGO_OBIETTIVO` il giro costa un conteggio sul database e via.

Push su `main` → Railway ricostruisce e sostituisce il deploy. Nessun passaggio manuale.
Le migrazioni girano come pre-deploy del `web`: se falliscono, il deploy vecchio resta in piedi.
Ogni servizio guarda solo la sua parte del repo (`watchPatterns`): toccare il worker non ricostruisce il web.

Produzione: <https://web-production-ad6b7.up.railway.app>
Il database dentro Postgres si chiama ancora `cassetta`, il nome di lavoro di prima: rinominarlo vuol dire ricreare il volume, e finche' non ci sono dati veri non vale la pena.
Il Postgres ha anche un proxy TCP pubblico (`DATABASE_PUBLIC_URL`), serve per lavorare in locale e per `db:studio`. Se un giorno non serve piu', va tolto.

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

Direzione scelta: **caldo e contemporaneo**. Fondo bianco, angoli morbidi, ombre leggere, tre colori vivi presi dal cibo. Niente spigoli, niente superfici fredde.

I token stanno in `apps/web/app/globals.css`, dentro `@theme`. La palette di default di Tailwind resta azzerata con `--color-*: initial`: `slate`, `zinc` e `gray` non sono raggiungibili. I neutri hanno tutti una punta di verde, cosi' stanno insieme al resto invece di sembrare grigi di sistema.

```
basilico    #1EB85C   azioni, conferme, il colore che comanda
pomodoro    #E8402A   allergeni, errori, scadenze
limone      #FFC629   attenzione, colazione, evidenziazioni
inchiostro  #14261C   testo
fumo        #64786C   testo secondario
fondo       #F6FAF7   fondo pagina
bianco      #FFFFFF   superficie delle schede
bordo       #E4ECE7   filetti
```

`font-marchio` e' Fraunces (marchio e titoli), `font-testo` e' Plus Jakarta Sans (tutto il resto). La classe `cifre` mette le cifre tabulari dove i numeri si incolonnano: tempi, porzioni, prezzi.

Quattro utility, e sono l'intero sistema:

- `scheda` — superficie bianca, `--radius-scheda` (24px), ombra d'appoggio
- `bottone` — pillola verde piena, per l'azione principale
- `bottone-chiaro` — pillola verde tenue, per le azioni secondarie
- `pillola` — l'etichetta della fascia sopra ogni ricetta

Ogni fascia ha il suo colore fisso in tutta l'app: colazione, spuntino e merenda su limone; pranzo e antipasto su basilico; cena e dolce su pomodoro.

Regole:

- L'ombra si usa per dire "questa e' una superficie", non per decorare. Due sole ombre: `shadow-appoggio` a riposo, `shadow-sollevata` sotto il dito
- Il verde e' il colore dell'azione. Rosso solo per quello che non va o non si puo' mangiare, giallo per quello che chiede attenzione
- Le foto delle ricette vanno grandi, mai francobolli in una griglia
- Niente font Inter, niente palette `slate` / `zinc` / `gray`, niente emoji al posto delle icone, niente `->` nel testo dei pulsanti

Prima di scrivere CSS per una schermata nuova: piano compatto di colore, tipografia e layout, e usa le utility che ci sono invece di inventarne altre.

Librerie previste quando servono (non installate finche' non servono): Base UI o Radix vestiti a mano, Motion per i momenti animati, Embla, Phosphor Icons, Vaul per i pannelli dal basso, NumberFlow per i numeri che cambiano.

## Copy

Italiano, tono diretto, frasi brevi. I pulsanti dicono cosa succede ("Salva il piano", non "Conferma"). Gli stati vuoti dicono cosa fare, non si scusano.

## Stato

Fase 0 chiusa: repo, Postgres con volume, web e worker in produzione, deploy automatico su push, migrazioni al deploy.

Fatto: catalogo che si riempie da solo dalle sitemap, wizard, piano settimanale composto dagli alimenti, pagina ricetta, import manuale come attrezzo da officina.

Manca, e serve `ANTHROPIC_API_KEY` su Railway: normalizzazione degli ingredienti delle **ricette**, e quindi allergeni sulle ricette, reparti e lista della spesa.

## Come si compone un pasto

Questa e' la parte che regge l'app, ed e' stata rifatta dopo che il primo piano generava tiramisu' a colazione. Il problema non era un filtro tarato male: era prendere una ricetta intera raccattata da un sito e infilarla in una casella. Una ricetta cosi' non ha pesi, la sua fascia e' indovinata da una parola, e non si sa cosa contiene - quindi nessuna regola nutrizionale e' applicabile.

Adesso il piano si costruisce dagli alimenti, in tre strati:

1. **`alimenti`** — il vocabolario, in `packages/db/src/alimenti/vocabolario.ts` e seminato a ogni deploy. Ogni voce ha gruppo, ruoli che puo' coprire, fasce, porzione tipica ed **etichette** (lattosio, glutine, pane, maiale, carne rossa, pesce, uova, frutta a guscio, fritto, proteico, zuccheri)
2. **Schemi di pasto** — `apps/web/lib/nutrizione/schemi.ts`. Un pranzo vuole base + proteina + verdura + grasso, una colazione latticino + cereale + semi. Sono la struttura, non il contenuto
3. **Il compositore** — `apps/web/lib/nutrizione/componi.ts`. Sceglie uno schema della fascia e riempie ogni posto pescando prima fra gli alimenti spuntati nel wizard, poi fra quelli che l'impostazione favorisce, poi fra tutti

La ricetta e' diventata un **suggerimento**: `ideaRicetta` cerca in catalogo qualcosa che usi il componente principale. La corrispondenza e' sul testo grezzo, quindi si mostra come "idea per cucinarli" e mai come prescrizione.

### Esclusioni e impostazione sono due cose diverse

Non vanno mai mischiate nella stessa lista, ed e' questo che rendeva inutile la versione precedente del wizard.

- **Esclusioni** (`profilo.esclusioni`): etichette. Rigide. Un alimento che ne porta una non entra mai, in nessuno schema. Sono affidabili perche' l'etichetta sta sull'alimento
- **Impostazione** (`profilo.impostazione`): una sola alla volta. Non toglie niente, sposta i moltiplicatori di porzione per ruolo. La proteica alza la proteina e abbassa la base, quella per dimagrire taglia i grassi ed esclude i fritti

`profilo.alimentiScelti` sono gli ingredienti spuntati nel wizard: il compositore pesca prima da li'. Vuoto vuol dire "pesca da tutto", non "non pescare niente".

Due regole che restano finche' manca la chiave:

- Finche' `ricette.normalizzataIl` e' nulla, l'app **non** sa gli allergeni di quella ricetta e deve dirlo. Mai "senza allergeni" su una ricetta non normalizzata
- Le esclusioni valgono sugli **alimenti**, non sulle ricette suggerite. La UI lo dichiara: chi ha un'allergia vera non deve fidarsi di un suggerimento di ricetta

### La classificazione delle ricette

`ricette.ruolo` (primo, secondo, dolce...) decide `ricette.fasce`, cioe' in quali pasti una ricetta puo' essere suggerita. Sta in `apps/web/lib/ricette/fasce.ts` ed e' una tabella di parole, non un modello: costa zero e si corregge a mano. Ruolo nullo vuol dire che non l'abbiamo capito, e la ricetta non viene mai suggerita.
