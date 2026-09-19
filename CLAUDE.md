# èProntooo

Webapp di pianificazione pasti, lista della spesa e confronto offerte dei supermercati. Uso privato, non commerciale: poche persone che si conoscono, ognuna col suo pannello.

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

## Chi e' chi

Ogni persona ha il suo pannello: la sua lista, le sue giornate, il suo peso. Le tabelle personali portano `utente_id`, quelle condivise no - il vocabolario degli alimenti, il catalogo, i volantini sono fatti uguali per tutti.

La regola che tiene: **`utenteId` e' un parametro obbligatorio** delle funzioni che leggono o scrivono dati personali, non una cosa che ognuna si legge dalla sessione. Dimenticarsene sarebbe una query senza filtro, cioe' i dati di un altro; cosi' invece non compila. E dove un id arriva da un form - un pasto da spuntare, una voce da cambiare - si controlla il proprietario **prima** di toccare: un id non e' una prova di proprieta'.

Il primo che si iscrive entra senza invito. Dal secondo in poi serve `CODICE_INVITO`, perche' l'indirizzo e' pubblico.

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

## I volantini

Stanno in `apps/web/lib/offerte/`. Un volantino non e' un documento, e' un manifesto: il testo che ne esce e' a pezzi, senza un ordine affidabile, col prezzo che a volte precede il prodotto e a volte lo segue. Quindi non si cerca una struttura - non c'e' - si cerca **il prezzo**, e intorno al prezzo si guarda cosa c'e'. Le righe senza prezzo sono slogan, orari, indirizzi, e si buttano.

`agganciaOfferta` non basta che agganci: deve dire **quanto** ci crede. Il punteggio mette insieme quanto del nome dell'alimento e' dentro il nome dell'offerta (pesa il doppio: il volantino ha sempre marca e formato in piu') e quanto del nome dell'offerta e' spiegato dall'alimento (che e' quello che scarta "Gelato al pistacchio" per "Pistacchi"). Sotto `SOGLIA_CERTA` l'offerta si mostra come **da verificare**, mai come certa, e il consiglio su dove andare si fa solo sulle certe.

Il consiglio delle tappe e' prudente per scelta: due tappe si consigliano solo se rendono almeno tre euro o quattro cose in piu'.

I volantini li scarica il worker (`apps/worker/volantini.py`), dentro il ciclo che gia' gira: nessun servizio in piu' e nessun cron. Un volantino dura una settimana, quindi prima di muoversi si guarda in database se per quell'insegna ce n'e' gia' uno fresco - nel caso normale il giro costa una query. Il PDF non si legge nel worker: si passa a `POST /api/interno/volantino`, perche' il lettore deve restare uno solo, come per le ricette.

Le pagine dei volantini cambiano spesso e il PDF non sta sempre nello stesso posto, quindi non si cerca un indirizzo preciso: si prende la pagina e si cercano **tutti** i link a un PDF, anche dentro i blob JSON, scartando informative e regolamenti. Quando una fonte smette di funzionare i log lo dicono con chiarezza invece di tacere, ed e' li' che si va a guardare - il primo giro vero ha risposto 404 su tutte e tre le insegne, ed e' cosi' che l'ho saputo.

**Quello che si e' visto provando davvero**: MD pubblica un PDF e si legge. Lidl ed Eurospin il volantino lo fanno solo sfogliare - nessun PDF in nessuna delle pagine, Lidl passa per `esi.leaflets.schwarz` - e per leggere i loro prezzi servirebbe guardare le immagini, cioe' la chiave. Per quelle insegne resta il caricamento a mano, e non e' pigrizia: non c'e' un file da scaricare.

Conad non sta nel codice ma in `VOLANTINO_CONAD_URL`, e non e' pigrizia: e' una cooperativa, il volantino cambia per cooperativa regionale e per negozio, e scriverne uno fisso qui dentro vorrebbe dire mostrare prezzi che non sono quelli che paghi.

## L'app sul telefono

`apps/web/public/sw.js` e `app/manifest.ts`. Il caso vero non e' "sono offline", e' il supermercato sottoterra con la lista della spesa aperta: le pagine si prendono dalla rete quando c'e' - i dati cambiano, e una lista vecchia e' peggio di nessuna lista - e dalla copia quando la rete non risponde. Le POST non si toccano mai: le azioni del server scrivono sul database, e una POST rigiocata dalla copia scriverebbe due volte.

I promemoria sono due e devono restare due: la sera se non hai registrato niente, il giovedi' per fare la settimana in tempo per la spesa. Un'app che notifica di continuo la spegni, e allora non serve piu'. Prima di mandare si guarda se serve: un promemoria che dice una cosa gia' fatta e' rumore.

Chi decide **se** e **quando** e' il web, in `lib/promemoria/manda.ts`, che ha davanti il database e sa che ore sono a Roma. Il worker bussa e basta a `POST /api/interno/promemoria` una volta per giro, perche' e' l'unica cosa che gira sempre. Senza le chiavi VAPID non si manda niente e non e' un errore: i promemoria sono un di piu'.

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

Fatto: login multiutente, scelta degli ingredienti per macro-categorie, volantini scaricati da soli, catalogo che si riempie da solo dalle sitemap, wizard, lista degli ingredienti (PDF del nutrizionista o scelta a mano), giornata ON/OFF con ricalibrazione, lista della spesa derivata, ricettario per componenti e modalita' cucina, volantini e offerte con soglia di confidenza, PWA installabile che regge senza rete, promemoria push, storico e peso, import manuale come attrezzo da officina.

Manca, e serve `ANTHROPIC_API_KEY` su Railway: normalizzazione degli ingredienti delle **ricette**, e quindi allergeni sulle ricette, reparti e lista della spesa.

## Come si compone un pasto

Questa e' la parte che regge l'app, ed e' stata rifatta dopo che il primo piano generava tiramisu' a colazione. Il problema non era un filtro tarato male: era prendere una ricetta intera raccattata da un sito e infilarla in una casella. Una ricetta cosi' non ha pesi, la sua fascia e' indovinata da una parola, e non si sa cosa contiene - quindi nessuna regola nutrizionale e' applicabile.

Adesso il piano si costruisce dagli alimenti, in tre strati:

1. **`alimenti`** — il vocabolario, in `packages/db/src/alimenti/vocabolario.ts` e seminato a ogni deploy. Ogni voce ha gruppo, ruoli che puo' coprire, fasce, porzione tipica ed **etichette** (lattosio, glutine, pane, maiale, carne rossa, pesce, uova, frutta a guscio, fritto, proteico, zuccheri)
2. **La tua lista** — `liste` e `lista_voci`, riempite dal PDF del nutrizionista oppure dalla spunta per categorie su `/ingredienti/gusti`. Ogni riga e' un posto in una fascia, con dentro le alternative equivalenti e i grammi. Dalla spunta la lista si costruisce da sola (`lib/lista/gusti.ts`), e ogni alimento finisce **solo nelle fasce che il vocabolario gli concede**: non e' un filtro messo dopo, la fettina non entra proprio nella colazione
3. **Il compositore** — `apps/web/lib/giornata/componi.ts`. Per ogni riga della fascia pesca **una** alternativa e le applica il moltiplicatore del tipo di giorno

La scelta fra alternative non e' un caso cieco: `lib/nutrizione/preferenze.ts` la inclina verso quello che mangi davvero (solo sopra `PASTI_MINIMI` pasti registrati - sotto, "mangi sempre il pollo" vuol dire che e' uscito due volte) e verso quello che e' in offerta questa settimana. I pesi cambiano **la frequenza, mai l'insieme**: le alternative restano quelle della tua lista, e un alimento con peso basso esce lo stesso ogni tanto, altrimenti dopo un mese mangeresti sempre le stesse quattro cose.

Le **sostituzioni equivalenti** (`lib/nutrizione/sostituzioni.ts`) rispondono a "non ho il pollo, ho il merluzzo". Non si cambia a peso - il merluzzo ha meno proteine, e 150 g di merluzzo al posto di 150 g di pollo perdono mezza porzione - si cambia a nutriente, e quale nutriente comanda dipende dal ruolo: proteina a proteine, base a carboidrati, grasso a grassi, verdura a peso perche' li' conta il volume.

### Il ricettario di casa

Sta in `apps/web/lib/ricettario/`. Una ricetta del catalogo e' un blocco chiuso: porta i suoi ingredienti e i suoi grammi, e per usarla dovresti piegare la tua lista alla sua. Una ricetta del ricettario porta invece **posti** (`{pasta}`, `{verdura}`, `{grasso}`), e i posti li riempiono i componenti del pasto, coi grammi gia' calcolati. La stessa ricetta vale per chiunque e per ogni giorno, e non serve la chiave: e' un elenco scritto a mano in `libro.ts`.

`abbina` assegna un componente per posto - prima i posti stretti, quelli che accettano pochi gruppi, altrimenti un posto largo si prende il componente che serviva a un posto stretto. Il gruppo dell'alimento conta piu' del ruolo: il ruolo lo deduciamo noi, il gruppo sta scritto nel vocabolario.

La compatibilita' ha tre livelli e non e' si'/no, perche' il si'/no butterebbe via quasi tutto: **calza** (usa i componenti del pasto), **vicina** (li usa, qualcuno fuori dal solito), **adattabile** (manca un posto e l'app dice quale). Due posti vuoti non sono un adattamento: e' un'altra ricetta, e la proposta si scarta.

`giornata_pasti.ricetta_libro` tiene quale hai scelto, cosi' "altra ricetta" non ricompone il pasto: i grammi restano quelli, cambia solo come li cucini. Ricomporre il pasto azzera la scelta.

Il catalogo raccolto dai siti **non** compare piu' nella scheda del giorno. Quelle ricette non sono normalizzate, quindi non si puo' garantire che non contengano quello che non ti piace - ed e' esattamente la garanzia che regge il ricettario. Restano sfogliabili su `/ricette`, come archivio.

### Esclusioni e impostazione sono due cose diverse

Non vanno mai mischiate nella stessa lista, ed e' questo che rendeva inutile la versione precedente del wizard.

- **Esclusioni** (`profilo.esclusioni`): etichette. Rigide. Un alimento che ne porta una non entra mai, in nessuno schema. Sono affidabili perche' l'etichetta sta sull'alimento
- **Impostazione** (`profilo.impostazione`): una sola alla volta. Non toglie niente, sposta i moltiplicatori di porzione per ruolo. La proteica alza la proteina e abbassa la base, quella per dimagrire taglia i grassi ed esclude i fritti

`profilo.alimentiScelti` sono gli ingredienti spuntati su `/ingredienti/gusti`: la stessa spunta che costruisce la lista, e che serve poi a pesare le alternative e a proporre le sostituzioni.

Due regole che restano finche' manca la chiave:

- Finche' `ricette.normalizzataIl` e' nulla, l'app **non** sa gli allergeni di quella ricetta e deve dirlo. Mai "senza allergeni" su una ricetta non normalizzata
- Le esclusioni valgono sugli **alimenti**, non sulle ricette suggerite. La UI lo dichiara: chi ha un'allergia vera non deve fidarsi di un suggerimento di ricetta

### La classificazione delle ricette

`ricette.ruolo` (primo, secondo, dolce...) decide `ricette.fasce`, cioe' in quali pasti una ricetta puo' essere suggerita. Sta in `apps/web/lib/ricette/fasce.ts` ed e' una tabella di parole, non un modello: costa zero e si corregge a mano. Ruolo nullo vuol dire che non l'abbiamo capito, e la ricetta non viene mai suggerita.
