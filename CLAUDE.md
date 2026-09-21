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

Fatto: login multiutente, benvenuto a passi, scelta degli ingredienti per macro-categorie, volantini scaricati da soli, catalogo che si riempie da solo dalle sitemap, wizard, lista degli ingredienti (PDF del nutrizionista o scelta a mano), giornata ON/OFF con ricalibrazione, lista della spesa derivata, ricettario per componenti e modalita' cucina, volantini e offerte con soglia di confidenza, PWA installabile che regge senza rete, promemoria push, storico e peso, import manuale come attrezzo da officina.

Manca solo `ANTHROPIC_API_KEY` su Railway. La catena e' scritta e deployata: senza chiave il worker lo dice nei log a ogni giro e il catalogo resta sfogliabile com'era; il giorno che la chiave c'e', parte da sola.

## Come si compone un pasto

Questa e' la parte che regge l'app, ed e' stata rifatta dopo che il primo piano generava tiramisu' a colazione. Il problema non era un filtro tarato male: era prendere una ricetta intera raccattata da un sito e infilarla in una casella. Una ricetta cosi' non ha pesi, la sua fascia e' indovinata da una parola, e non si sa cosa contiene - quindi nessuna regola nutrizionale e' applicabile.

Adesso il piano si costruisce dagli alimenti, in tre strati:

1. **`alimenti`** — il vocabolario, in `packages/db/src/alimenti/vocabolario.ts` e seminato a ogni deploy. Non e' un database nutrizionale completo: e' un elenco scritto a mano, nato in buona parte dalle diete su cui e' stato tarato il lettore PDF - che erano estive - e poi allargato. Quando manca qualcosa si aggiunge li', con i valori CREA in `nutrienti.ts` e i mesi in `stagioni.ts`. Ogni voce ha gruppo, ruoli che puo' coprire, fasce, porzione tipica ed **etichette** (lattosio, glutine, pane, maiale, carne rossa, pesce, uova, frutta a guscio, fritto, proteico, zuccheri)
2. **La tua lista** — `liste` e `lista_voci`, riempite dal PDF del nutrizionista oppure dalla spunta per categorie su `/ingredienti/gusti`. Ogni riga e' un posto in una fascia, con dentro le alternative equivalenti e i grammi. Dalla spunta la lista si costruisce da sola (`lib/lista/gusti.ts`), e ogni alimento finisce **solo nelle fasce che il vocabolario gli concede**: non e' un filtro messo dopo, la fettina non entra proprio nella colazione
3. **Lo schema del pasto** — `apps/web/lib/giornata/schema.ts`. Quanti posti ha il piatto, e quali ruoli possono riempirli
4. **Il compositore** — `apps/web/lib/giornata/componi.ts`. Riempie i posti dello schema pescando dalla tua lista, e applica il moltiplicatore del tipo di giorno

Il terzo strato e' arrivato dopo, per una colazione vera che l'app aveva prodotto: torta fatta in casa, salmone affumicato, yogurt, avocado, marmellata, noci, mango e granita siciliana. Otto alimenti, ognuno lecito nella sua fascia, e insieme non una colazione ma un inventario. Il difetto non era la scelta di un alimento, era il **conteggio**: il compositore pescava una cosa da ogni riga, e le righe sono una per ruolo - quindi piu' spuntavi, peggio mangiavi.

La regola che ne esce: **la lista dice cosa puo' entrare, lo schema dice quanti ne entrano, i pesi dicono chi entra oggi.** Un pranzo ha base, proteina, verdura e condimento; una colazione ha base, latticino, frutta e quello che ci metti sopra; uno spuntino ne ha due. Un test impedisce a qualunque fascia di superare i quattro posti, perche' e' esattamente li' che si torna all'inventario.

Due conseguenze. L'obiettivo senza i dati del corpo si calcola su quello che il piano ti mette davvero nel piatto, non sulla somma di tutte le righe spuntate - sarebbe un bersaglio irraggiungibile. E "questo mese ti manca qualcosa" dice **cosa** manca ("Colazione senza la frutta"), perche' adesso sa quale posto e' rimasto vuoto

La scelta fra alternative non e' un caso cieco: `lib/nutrizione/preferenze.ts` la inclina verso quello che mangi davvero (solo sopra `PASTI_MINIMI` pasti registrati - sotto, "mangi sempre il pollo" vuol dire che e' uscito due volte) e verso quello che e' in offerta questa settimana. I pesi cambiano **la frequenza, mai l'insieme**: le alternative restano quelle della tua lista, e un alimento con peso basso esce lo stesso ogni tanto, altrimenti dopo un mese mangeresti sempre le stesse quattro cose.

Le **sostituzioni equivalenti** (`lib/nutrizione/sostituzioni.ts`) rispondono a "non ho il pollo, ho il merluzzo". Non si cambia a peso - il merluzzo ha meno proteine, e 150 g di merluzzo al posto di 150 g di pollo perdono mezza porzione - si cambia a nutriente, e quale nutriente comanda dipende dal ruolo: proteina a proteine, base a carboidrati, grasso a grassi, verdura a peso perche' li' conta il volume.

### Da quanto pesi a quanti grammi di pasta

`apps/web/lib/nutrizione/fabbisogno.ts`. Le porzioni del vocabolario sono numeri di riferimento scritti a mano - 80 g di pasta, 150 g di pollo - ragionevoli per un adulto medio e **non** tarati su nessuno. Se il profilo ha i dati del corpo diventano le tue:

1. **Mifflin-St Jeor** da' il metabolismo basale
2. il **fattore di attivita'** porta al fabbisogno giornaliero
3. l'**obiettivo** lo sposta (mantenere, dimagrire −15%, massa +10%), e il tipo di giorno pure
4. il totale si divide fra i pasti con le quote classiche, **normalizzate sulle fasce che hai davvero**: chi non fa merenda non perde quel 10%, se lo vede ridistribuito
5. ogni pasto si compone con le porzioni di riferimento e poi si scala col fattore che serve, riusando `scalaComponenti` della ricalibrazione - lo stesso pezzo che sa tagliare dai grassi prima che dalla proteina

Due vincoli che non si toccano: **mai sotto il metabolismo basale**, e chi dimagrisce prende **piu'** proteine (1,8 g/kg contro 1,4), perche' in deficit la proteina e' quello che tiene il muscolo mentre il resto cala. I macro si fissano su due vincoli - proteine dal peso, grassi al 27% delle calorie - e i carboidrati prendono quello che resta: fissarne tre da' percentuali che poi non tornano.

I dati del corpo si danno al primo passo del benvenuto e si cambiano da `/profilo`: oggi dimagrire, fra un anno mantenere. E l'app dice che e' una stima: una formula non vede gli esami.

### Le stagioni

`packages/db/src/alimenti/stagioni.ts`, e vale per frutta e verdura e per nient'altro: la pasta non ha stagione, e mettere dodici mesi accanto a ogni scatoletta sarebbe rumore. Chi non compare nella tabella e' disponibile sempre - quello che arriva da lontano tutto l'anno (banane, ananas, limoni) non ha stagione **qui**, e quello che si conserva per mesi (mele, patate, cipolle) al banco c'e' davvero sempre.

Il filtro sta nel **compositore**, non nella lista. La lista e' quello che ti piace, la giornata e' quello che si mangia oggi: cosi' le pesche restano spuntate tutto l'anno e a giugno tornano da sole. Fuori stagione non entra nel pasto e non entra nemmeno nell'obiettivo, altrimenti risulteresti sempre sotto.

Quando una riga resta senza niente di stagione - hai spuntato solo frutta estiva e siamo a gennaio - il componente salta e la schermata di oggi **lo dice**, invece di lasciare un buco muto.

Un test controlla che ogni mese dell'anno abbia almeno tre frutti e tre verdure disponibili: e' quello che impedisce di accendere le stagioni e scoprire che da ottobre a marzo non c'e' niente da proporre.

### Le dosi non sono quelle della ricetta

`apps/web/lib/giornata/dosi.ts`, e nasce da un pranzo vero: pasta col pesto, 30 g di olio, tre formaggi grattugiati da 5 g l'uno. Nessuno dei due numeri e' un errore di calcolo - sono quelli della fonte, ridotti in proporzione. Ed e' li' il problema.

Una ricetta di un sito di cucina e' scritta per far venire buono il piatto, non per far tornare la tua giornata. L'olio e' abbondante perche' l'olio fa buono, e chi cucina non lo pesa. **Scalare in proporzione conserva la verita' della ricetta - ed e' per questo che si scala - ma conserva anche le sue esagerazioni**: un piatto in cui meta' delle calorie e' condimento resta meta' condimento anche quando diventa piccolo.

Il metro non si inventa, c'e' gia': **ogni alimento del vocabolario ha scritto quanto e' una sua porzione**. 10 g di olio, 80 g di pasta, 30 g di parmigiano. Finora servivano solo a comporre i pasti dalla lista; qui diventano il limite. La ricetta dice **cosa** c'e' dentro, il vocabolario dice **quanto** ne va in un piatto. La prima cosa non si tocca mai, la seconda e' nostra - ed e' esattamente la riga fra citare una ricetta e riscriverla.

Tre passaggi, e il terzo conta quanto il primo:

1. **Il tetto.** Nessun ingrediente supera la sua porzione per piu' di 2,5 volte. Sta largo apposta: scatta solo quando la ricetta e' fuori scala, e una ricetta abbondante resta abbondante. I grassi aggiunti e i dolci stanno a 1,5, la frutta secca a 1,8, perche' sono l'unico posto dove tutte le ricette sbandano nella stessa direzione e dove a 9 kcal al grammo si vede subito
2. **Il q.b.** Sotto un quarto della porzione - e sotto i 20 g - non si scrive un peso. "Pecorino 5 g" ti fa comprare, pesare e sporcare una bilancia per un cucchiaino, e sembra una precisione che non abbiamo. Vale per condimenti, latticini, erbe, frutta: **non** per pasta, pane, carne, pesce, uova e legumi, che sono quello su cui il piatto si regge - se vengono minuscoli il difetto sta altrove, e un "q.b." lo nasconderebbe
3. **Le calorie tolte tornano.** Togliere 15 g di olio vuol dire togliere 135 kcal, e un pranzo che doveva darne 650 e ne da' 515 non e' piu' sano: ti fa alzare con fame, che e' il modo piu' sicuro di mollare una dieta. Tornano **sul resto** - piu' pasta, piu' verdura, piu' proteina - che e' quello che direbbe chiunque davanti a un piatto troppo condito: meno olio, non meno piatto. Sul condimento non tornano mai, altrimenti il primo passaggio si annullerebbe da solo

Sul pranzo da cui e' nato: da 57% di calorie dal grasso a 32%, calorie invariate.

**Il catalogo non si tocca.** Le dosi si sistemano quando il piatto si compone, non riscrivendo le 2000 righe in database: su `/ricette` la ricetta resta quella scaricata, com'e' giusto, e cambia il **tuo** piatto. E una dose ridotta si dichiara - la pillola "ridotto" accanto all'ingrediente - perche' chi apre la ricetta alla fonte trova scritto il doppio dell'olio e senza una riga penserebbe a un errore.

Quello che dosare **non** puo' fare e' aggiungere quello che nel piatto non c'e': un pesto resta senza proteine per quanto lo si aggiusti. Quello e' mestiere della **scelta** della ricetta (`distanza` in `daRicetta.ts`), che e' l'altra meta' ed e' un problema diverso.

### Dal catalogo al ricettario

`apps/web/lib/ricette/normalizza.ts` e `posti.ts`, con `archivio.ts` che tiene il conto.

Il catalogo raccolto dai siti aveva tutto quello che serve per una scheda - foto, ingredienti, procedimento - e non si poteva usare, per due motivi che sono lo stesso motivo: una ricetta del catalogo e' un **blocco chiuso**. Porta i suoi grammi, e infilarla nel piano vuol dire o ignorare i suoi - e allora la foto mente sulle porzioni - o ignorare i tuoi, e allora tutto il calcolo su peso, altezza e obiettivo diventa decorazione. E non sappiamo cosa contiene, quindi nessuna esclusione e' garantita.

La normalizzazione scioglie tutti e due i nodi in un colpo. Ogni ricetta si legge **una volta sola** e il risultato si salva sulla riga: le righe diventano alimenti del vocabolario, le etichette si sommano dagli alimenti (mai dai tag della fonte), e i ruoli diventano i **posti**. A quel punto quella ricetta e' una ricetta del ricettario a tutti gli effetti - i tuoi grammi ci entrano dentro - e si porta dietro la foto e il procedimento veri.

Tre scelte che tengono:

- **Il modello sceglie per nome, non per id.** Un nome inventato non si risolve e la riga diventa `sconosciuto`, che e' quello che vogliamo; un id inventato punterebbe a un alimento vero e non se ne accorgerebbe nessuno
- **Una riga non capita toglie la garanzia a tutta la ricetta.** Se non so cos'e' la terza riga non posso giurare che dentro non ci sia glutine, quindi `posti` resta vuoto e la ricetta non entra nel piano: resta sfogliabile. E' la differenza fra "questa ricetta non contiene pesce" e "nelle righe che ho capito non c'e' pesce"
- **Il procedimento resta parola della fonte.** Non ci infiliamo segnaposto: "cuocete la pasta" va bene per 80 g come per 120, e riscrivere il testo di qualcun altro per far tornare un numero romperebbe una ricetta che funziona. La fonte si cita, col link

Gira su Haiku perche' il lavoro e' estrazione, non giudizio - si cambia con `MODELLO_NORMALIZZA` - e con gli structured outputs, che garantiscono la forma invece di sperarci. Il worker bussa a `POST /api/interno/normalizza` un blocco alla volta (`RICETTE_PER_GIRO`, venti): il vocabolario resta nella cache del prompt fra una ricetta e l'altra, un errore costa un blocco e non un giro, e la spesa si spalma. Senza la chiave la rotta risponde 503 col motivo scritto, e nei log si legge - non e' un guasto.

### Il ricettario di casa

Sta in `apps/web/lib/ricettario/`. Una ricetta del catalogo e' un blocco chiuso: porta i suoi ingredienti e i suoi grammi, e per usarla dovresti piegare la tua lista alla sua. Una ricetta del ricettario porta invece **posti** (`{pasta}`, `{verdura}`, `{grasso}`), e i posti li riempiono i componenti del pasto, coi grammi gia' calcolati. La stessa ricetta vale per chiunque e per ogni giorno, e non serve la chiave: e' un elenco scritto a mano in `libro.ts`.

`abbina` assegna un componente per posto - prima i posti stretti, quelli che accettano pochi gruppi, altrimenti un posto largo si prende il componente che serviva a un posto stretto. Il gruppo dell'alimento conta piu' del ruolo: il ruolo lo deduciamo noi, il gruppo sta scritto nel vocabolario.

La compatibilita' ha tre livelli e non e' si'/no, perche' il si'/no butterebbe via quasi tutto: **calza** (usa i componenti del pasto), **vicina** (li usa, qualcuno fuori dal solito), **adattabile** (manca un posto e l'app dice quale). Due posti vuoti non sono un adattamento: e' un'altra ricetta, e la proposta si scarta.

`giornata_pasti.ricetta_libro` tiene quale hai scelto, cosi' "altra ricetta" non ricompone il pasto: i grammi restano quelli, cambia solo come li cucini. Ricomporre il pasto azzera la scelta.

Il libro scritto a mano e il catalogo normalizzato finiscono nello stesso mucchio: `proposte()` li mette insieme, perche' una volta convertita una ricetta del catalogo parla la stessa lingua. Gli id del catalogo portano il prefisso `catalogo-`, altrimenti l'id 12 del libro e l'id 12 del catalogo sarebbero la stessa cosa dentro `giornata_pasti.ricetta_libro`.

I passi delle ricette del catalogo si leggono **solo per quella scelta**: sono il campo piu' pesante della riga, e caricarli per duecento candidate a ogni apertura della pagina di oggi sarebbe mezzo mega per niente.

Una ricetta del catalogo non ancora normalizzata, o normalizzata ma con una riga non capita, ha `posti` vuoto e non entra nel piano. Resta sfogliabile su `/ricette`, che e' quello per cui il catalogo e' nato.

### Il benvenuto a passi

`apps/web/app/benvenuto/[passo]` e i passi in `apps/web/lib/benvenuto/passi.ts`. Chi si iscrive non trova una colonna di schede da compilare - quella la chiudi - ma una domanda per volta: **corpo**, **movimento**, **come stai**, **cosa non mangi**, e in fondo la spunta degli ingredienti, che e' l'ultimo passo anche se vive su `/ingredienti/gusti`. Per questo la barra conta `PASSI_TOTALI`, cioe' uno in piu' dei passi del benvenuto.

Ogni passo **scrive subito** invece di tenere tutto in memoria fino alla fine. Serve a due cose: se chiudi il telefono a meta' non ricominci da capo, e soprattutto il passo dopo puo' leggere quello che hai appena scelto. E' cosi' che chi al quarto passo toglie il pesce, al quinto non se lo trova fra le caselle da spuntare - l'esclusione e' gia' nel database quando la schermata degli ingredienti fa la sua query. Una domanda che dipende da una risposta ancora in un campo nascosto non sarebbe personalizzata, sarebbe indovinata.

L'ordine dei passi segue la stessa logica: **la salute viene prima di cosa togliere**, perche' una condizione puo' proporre un'esclusione - il glutine con Hashimoto - e `esclusioniSuggeriteDa` la mostra accanto alla sua casella, in giallo, col motivo e il nome della condizione che la propone. Proposta, mai spuntata: la condizione inclina le porzioni da sola, il divieto lo accendi tu. Una proposta che arrivasse dopo la domanda non servirebbe a niente.

`/profilo` resta la stessa roba per intero, su una pagina sola: il benvenuto e' il primo giro, il profilo e' dove si torna. Chi arriva su una pagina che compone un piano senza i dati del corpo viene mandato a `/benvenuto/corpo` da `utenteConProfilo()`, e dentro il benvenuto non si salta avanti: senza il primo passo gli altri non hanno su cosa appoggiarsi.

### Esclusioni e impostazione sono due cose diverse

Non vanno mai mischiate nella stessa lista, ed e' questo che rendeva inutile la versione precedente del wizard.

- **Esclusioni** (`profilo.esclusioni`): etichette. Rigide. Un alimento che ne porta una non entra mai, in nessuno schema. Sono affidabili perche' l'etichetta sta sull'alimento
- **Impostazione** (`profilo.impostazione`): una sola alla volta. Non toglie niente, sposta i moltiplicatori di porzione per ruolo. La proteica alza la proteina e abbassa la base, quella per dimagrire taglia i grassi ed esclude i fritti

- **Attenuazioni** (`profilo.attenuazioni`): la via di mezzo, in `lib/nutrizione/attenuazioni.ts`. Esistono per due etichette sole e fanno due cose diverse. Il **glutine si riduce**: una fonte per pasto, non piu' di `PASTI_CON_GLUTINE` pasti al giorno, e se togliendola la riga resta vuota passa lo stesso - `preferiSenza` e' tutta qui, ed e' la differenza fra ridurre e togliere. Il **lattosio si sostituisce**: la mozzarella diventa mozzarella senza lattosio, stesso posto e stessi grammi (`packages/db/src/alimenti/lattosio.ts`). Gli stagionati restano dove sono, il lattosio se l'e' mangiato la stagionatura. Un'attenuazione su un'etichetta che escludi non ha senso e si scarta: vince l'esclusione, che e' la scelta piu' netta

Perche' esistono: fra l'allergia e il niente c'e' il caso piu' comune di tutti - gli esami dicono che non sei celiaco, ma quando esageri con pasta e pane stai gonfio. Togliere il glutine a quella persona la fa vivere da celiaco senza esserlo, e senza la diagnosi nessuno controlla che la dieta resti completa.

`profilo.alimentiScelti` sono gli ingredienti spuntati su `/ingredienti/gusti`: la stessa spunta che costruisce la lista, e che serve poi a pesare le alternative e a proporre le sostituzioni.

Due regole che restano finche' manca la chiave:

- Finche' `ricette.normalizzataIl` e' nulla, l'app **non** sa gli allergeni di quella ricetta e deve dirlo. Mai "senza allergeni" su una ricetta non normalizzata
- Le esclusioni valgono sugli **alimenti**, non sulle ricette suggerite. La UI lo dichiara: chi ha un'allergia vera non deve fidarsi di un suggerimento di ricetta

### Le condizioni di salute

`apps/web/lib/nutrizione/condizioni.ts`, dieci: Hashimoto, colesterolo, pressione, glicemia, reflusso, colon irritabile, gotta, ferro basso, fegato grasso, stitichezza. Una condizione **inclina, non vieta** - sposta quanto spesso un alimento esce, e non toglie mai niente per sempre: il divieto sta fra le esclusioni, che scegli tu, e non si accende da solo per una diagnosi.

Ogni regola dice cosa fa **e quanto si sa**, con le prove guardate una per una: sul kiwi nella stitichezza c'e' scritto che regge il confronto con lo psillio ed e' quello che si smette di prendere meno spesso; sulle ciliegie nella gotta c'e' scritto che la certezza e' bassa e le metto perche' non costano niente; sui tannini del te' c'e' scritto che conta **quando** lo bevi, e che la distanza dalla tazzina l'app non la sa. Le regole si spengono una alla volta.

`esclusioniSuggeriteDa` fa proporre a una condizione un'esclusione senza accenderla - il glutine con Hashimoto - ed e' il motivo per cui nel benvenuto il passo "come stai" viene **prima** di "cosa non mangi". Nell'interfaccia le regole stanno chiuse finche' non spunti la patologia, e si aprono senza una riga di JavaScript (`app/componenti/salute.tsx`, una copia sola per benvenuto e profilo).

### La classificazione delle ricette

`ricette.ruolo` (primo, secondo, dolce...) decide `ricette.fasce`, cioe' in quali pasti una ricetta puo' essere suggerita. Sta in `apps/web/lib/ricette/fasce.ts` ed e' una tabella di parole, non un modello: costa zero e si corregge a mano. Ruolo nullo vuol dire che non l'abbiamo capito, e la ricetta non viene mai suggerita.
