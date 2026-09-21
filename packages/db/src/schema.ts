import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * Chi usa l'app. Ognuno ha il suo pannello: la sua dieta, i suoi giorni, il
 * suo peso. Non si vedono fra loro, e non e' una questione di permessi - e'
 * che due diete diverse nella stessa tabella sono due diete sbagliate.
 *
 * La password si salva come scrypt con sale per riga. Non ci sono librerie:
 * scrypt sta dentro Node, ed e' la funzione giusta per questo.
 */
export const utenti = pgTable(
  'utenti',
  {
    id: serial('id').primaryKey(),
    nome: text('nome').notNull(),
    // Minuscolo sempre: e' la chiave con cui si entra.
    email: text('email').notNull(),
    hash: text('hash').notNull(),
    creatoIl: timestamp('creato_il', { withTimezone: true }).notNull().defaultNow(),
    ultimoAccesso: timestamp('ultimo_accesso', { withTimezone: true }),
  },
  (t) => [uniqueIndex('utenti_email_idx').on(t.email)],
)

export type Utente = typeof utenti.$inferSelect

/**
 * Vocabolario degli allergeni.
 *
 * Regola di dominio: un allergene si attribuisce a una ricetta passando dagli
 * ingredienti canonici, mai dai tag dichiarati dalla fonte. Questa tabella e'
 * solo l'elenco chiuso dei codici ammessi; il legame vero e' in
 * `ingrediente_allergene`.
 */
export const allergeni = pgTable(
  'allergeni',
  {
    id: serial('id').primaryKey(),
    codice: text('codice').notNull(),
    nome: text('nome').notNull(),
    note: text('note'),
    creatoIl: timestamp('creato_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('allergeni_codice_idx').on(t.codice)],
)

export type Allergene = typeof allergeni.$inferSelect
export type NuovoAllergene = typeof allergeni.$inferInsert

/**
 * Battito del worker. Il worker Python non espone HTTP: l'unico modo per sapere
 * che gira davvero e' che lasci una riga qui a ogni esecuzione. La home la legge
 * e mostra l'ultimo giro.
 */
export const battiti = pgTable('battiti', {
  id: serial('id').primaryKey(),
  servizio: text('servizio').notNull(),
  messaggio: text('messaggio').notNull(),
  registratoIl: timestamp('registrato_il', { withTimezone: true }).notNull().defaultNow(),
})

export type Battito = typeof battiti.$inferSelect

/**
 * L'ingrediente normalizzato: `ricotta`, `farina 00`, `passata di pomodoro`.
 *
 * Ci arriva una volta sola, quando l'LLM normalizza le righe grezze di una
 * ricetta. Da qui in poi e' questa riga a decidere reparto, allergeni e
 * stagionalita', non il testo scritto dalla fonte.
 */
export const ingredientiCanonici = pgTable(
  'ingredienti_canonici',
  {
    id: serial('id').primaryKey(),
    nome: text('nome').notNull(),
    categoria: text('categoria'),
    // Il reparto del supermercato: ortofrutta, banco frigo, dispensa, surgelati.
    // Serve a ordinare la lista della spesa sul percorso fisico (Fase 4).
    reparto: text('reparto'),
    // I mesi in cui ha senso comprarlo, 1-12. Vuoto = sempre disponibile.
    mesiStagione: jsonb('mesi_stagione').$type<number[]>().notNull().default([]),
    creatoIl: timestamp('creato_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ingredienti_canonici_nome_idx').on(t.nome)],
)

export type IngredienteCanonico = typeof ingredientiCanonici.$inferSelect

/**
 * Ingrediente canonico -> allergene. E' il cuore della correttezza dell'app.
 *
 * Va curata a mano per i casi sporchi, quelli che nessun modello indovina da
 * solo: la salsa di soia e il dado contengono glutine, il pesto contiene latte
 * e frutta a guscio, molti insaccati contengono lattosio.
 */
export const ingredienteAllergene = pgTable(
  'ingrediente_allergene',
  {
    ingredienteId: integer('ingrediente_id')
      .notNull()
      .references(() => ingredientiCanonici.id, { onDelete: 'cascade' }),
    allergeneId: integer('allergene_id')
      .notNull()
      .references(() => allergeni.id, { onDelete: 'cascade' }),
    // `certo` quando e' sempre vero, `possibile` quando dipende dalla marca
    // (tracce, lecitina di soia, additivi). Un `possibile` va trattato come
    // certo dalle esclusioni rigide: in caso di allergia non si scommette.
    certezza: text('certezza').notNull().default('certo'),
  },
  (t) => [primaryKey({ columns: [t.ingredienteId, t.allergeneId] })],
)

/**
 * Una ricetta del catalogo, come e' stata letta dalla fonte.
 *
 * `normalizzataIl` e' la data in cui l'LLM ha mappato le righe ingrediente sugli
 * ingredienti canonici. Finche' e' nulla, di questa ricetta non si conoscono ne'
 * gli allergeni ne' il reparto: va mostrata come "da normalizzare", mai come
 * "senza allergeni".
 */
/**
 * Un posto di una ricetta: il buco che un componente del tuo pasto riempie.
 *
 * Sta qui e non in `apps/web` perche' lo salviamo dentro la riga: e' il
 * risultato della normalizzazione, non una cosa che si ricalcola a ogni
 * lettura.
 */
export type PostoRicetta = {
  chiave: string
  ruolo: string
  gruppi: string[]
  facoltativo?: boolean
  /**
   * L'alimento che ha generato questo posto, nelle ricette del catalogo.
   *
   * Le ricette scritte a mano non ce l'hanno e non devono averlo: "Pasta e
   * legumi" e' fatta per accettare qualunque pasta e qualunque legume, ed e'
   * quello il suo mestiere. Una ricetta del catalogo invece nasce da alimenti
   * precisi, e perderli vuol dire perdere di cosa parla.
   */
  alimentoId?: number
  nome?: string
  /**
   * L'alimento di questo posto e' scritto nel titolo della ricetta.
   *
   * E' la riga che impedisce a un titolo di mentire. "Baccala' alle verdure"
   * aveva un posto di gruppo `pesce`, e il gruppo `pesce` lo riempiono anche i
   * calamari e i gamberi: il piatto proposto diceva baccala' e dentro aveva i
   * calamari. Quando il nome e' nel titolo, quel posto vuole **quell'**
   * alimento e nessun altro.
   *
   * Dove il titolo non nomina niente - "Risotto alla monzese", "Zuppa di
   * verdure" - non scatta niente e la ricetta resta larga com'era: li' non c'e'
   * nessuna promessa da mantenere.
   */
  nelTitolo?: boolean
}

export const ricette = pgTable(
  'ricette',
  {
    id: serial('id').primaryKey(),
    titolo: text('titolo').notNull(),
    fonteUrl: text('fonte_url').notNull(),
    // Il dominio, per mostrare da dove arriva senza spacchettare l'URL ogni volta.
    fonteNome: text('fonte_nome').notNull(),
    immagineUrl: text('immagine_url'),
    descrizione: text('descrizione'),
    minutiPreparazione: integer('minuti_preparazione'),
    minutiCottura: integer('minuti_cottura'),
    minutiTotali: integer('minuti_totali'),
    porzioni: integer('porzioni'),
    difficolta: text('difficolta'),
    // La categoria come l'ha scritta la fonte: "Primi piatti", "Dolci".
    // Non si butta, perche' da li' si puo' sempre riclassificare.
    categoriaFonte: text('categoria_fonte'),
    // Il ruolo nel pasto: primo, secondo, piatto_unico, dolce, antipasto,
    // contorno, lievitato, bevanda.
    ruolo: text('ruolo'),
    // Le fasce in cui questa ricetta puo' finire. Un primo vale a pranzo e a
    // cena, una torta vale a colazione e a merenda. Vuoto = sta in catalogo ma
    // il piano non la usa mai.
    fasce: jsonb('fasce').$type<string[]>().notNull().default([]),
    passaggi: jsonb('passaggi').$type<string[]>().notNull().default([]),
    // I posti che questa ricetta espone, ricavati dagli ingredienti
    // normalizzati. E' quello che la fa entrare nel piano: una ricetta del
    // catalogo porta i suoi grammi, una ricetta a posti porta i tuoi. Vuoto =
    // non e' ancora convertibile, e resta solo in archivio.
    // Vedi apps/web/lib/ricette/posti.ts.
    posti: jsonb('posti').$type<PostoRicetta[]>().notNull().default([]),
    // Le etichette di tutti i suoi ingredienti messe insieme: glutine,
    // lattosio, pesce. Si riempie con la normalizzazione, ed e' quello che
    // permette di dire "questa ricetta non fa per te" senza tirare a indovinare.
    etichette: jsonb('etichette').$type<string[]>().notNull().default([]),
    // I nutrienti della ricetta **come sta scritta**, sommati dai suoi
    // ingredienti riconosciuti.
    //
    // Si salvano qui invece di ricalcolarli ogni volta, e non e' una
    // micro-ottimizzazione: senza, per sapere se una ricetta ha il profilo
    // giusto bisogna leggerne gli ingredienti, e per scegliere fra duemila
    // candidate bisognerebbe leggerli tutti. Con questi quattro numeri sulla
    // riga la scelta si fa in memoria e si legge una ricetta sola: quella
    // scelta.
    //
    // Nulli finche' la ricetta non e' stata letta, o se nessun ingrediente
    // porta valori: un piatto senza calorie non si puo' scalare.
    kcal: numeric('kcal', { precision: 10, scale: 2 }),
    proteine: numeric('proteine', { precision: 10, scale: 2 }),
    carboidrati: numeric('carboidrati', { precision: 10, scale: 2 }),
    grassi: numeric('grassi', { precision: 10, scale: 2 }),
    normalizzataIl: timestamp('normalizzata_il', { withTimezone: true }),
    importataIl: timestamp('importata_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Lo stesso link non entra due volte: reimportarlo aggiorna la riga esistente.
    uniqueIndex('ricette_fonte_url_idx').on(t.fonteUrl),
    index('ricette_titolo_idx').on(t.titolo),
  ],
)

export type Ricetta = typeof ricette.$inferSelect
export type NuovaRicetta = typeof ricette.$inferInsert

/**
 * Una riga della lista ingredienti, come l'ha scritta la fonte piu' quello che
 * ne abbiamo capito. `rigaGrezza` non si tocca mai: e' la fonte di verita' da
 * cui si puo' sempre rinormalizzare.
 */
export const ricettaIngredienti = pgTable(
  'ricetta_ingredienti',
  {
    id: serial('id').primaryKey(),
    ricettaId: integer('ricetta_id')
      .notNull()
      .references(() => ricette.id, { onDelete: 'cascade' }),
    posizione: integer('posizione').notNull(),
    rigaGrezza: text('riga_grezza').notNull(),
    quantita: numeric('quantita', { precision: 10, scale: 3 }),
    unita: text('unita'),
    ingredienteCanonicoId: integer('ingrediente_canonico_id').references(
      () => ingredientiCanonici.id,
      { onDelete: 'set null' },
    ),
    // L'alimento del vocabolario che questa riga e': lo scrive la
    // normalizzazione. Nullo vuol dire "non l'ho riconosciuto", ed e' un caso
    // normale - il sale e il basilico non sono alimenti del vocabolario.
    alimentoId: integer('alimento_id').references(() => alimenti.id, { onDelete: 'set null' }),
    // I grammi che ne vuole la ricetta della fonte. Servono a capire le
    // proporzioni, non a metterteli nel piatto: nel piatto vanno i tuoi.
    grammi: numeric('grammi', { precision: 10, scale: 2 }),
  },
  (t) => [index('ricetta_ingredienti_ricetta_idx').on(t.ricettaId)],
)

export type RicettaIngrediente = typeof ricettaIngredienti.$inferSelect
export type NuovoRicettaIngrediente = typeof ricettaIngredienti.$inferInsert

/**
 * Il profilo: una riga sola, quella dell'unico utente. L'output del wizard.
 *
 * Non c'e' un campo allergie di proposito. Le allergie si rispettano solo
 * passando dagli ingredienti canonici, e finche' quella pipeline non esiste
 * chiederle sarebbe una promessa che l'app non puo' mantenere. `daEvitare`
 * e' un'altra cosa: sono preferenze, e si applicano con una ricerca sul testo
 * della riga ingrediente. Approssimata, e dichiarata tale nella UI.
 */
/**
 * Le impostazioni di un utente. `id` e' l'id dell'utente, non una chiave sua:
 * un utente ha un profilo e un profilo ha un utente, e tenere due numeri
 * diversi per la stessa cosa e' solo un modo per farli divergere.
 */
export const profilo = pgTable('profilo', {
  id: integer('id').primaryKey(),
  utenteId: integer('utente_id').references(() => utenti.id, { onDelete: 'cascade' }),
  adulti: integer('adulti').notNull().default(2),
  bambini: integer('bambini').notNull().default(0),
  porzioniDefault: integer('porzioni_default').notNull().default(2),
  fasceAttive: jsonb('fasce_attive').$type<string[]>().notNull().default([]),
  // Giorni in cui sei fuori a pranzo, 0 = lunedi. Quei pasti non entrano nel piano.
  giorniFuoriPranzo: jsonb('giorni_fuori_pranzo').$type<number[]>().notNull().default([]),
  // Minuti massimi per fascia: { colazione: 10, cena: 45 }
  minutiMassimi: jsonb('minuti_massimi').$type<Record<string, number>>().notNull().default({}),
  daEvitare: jsonb('da_evitare').$type<string[]>().notNull().default([]),
  // Le etichette escluse: rigide, un alimento che ne porta una non entra mai.
  esclusioni: jsonb('esclusioni').$type<string[]>().notNull().default([]),
  // Come si spostano le proporzioni fra i ruoli: equilibrata, proteica,
  // dimagrire, piu_verdure, leggera_sera. Una sola alla volta.
  impostazione: text('impostazione').notNull().default('equilibrata'),
  // Gli alimenti che vuoi usare questa settimana: il piano pesca prima da qui.
  alimentiScelti: jsonb('alimenti_scelti').$type<number[]>().notNull().default([]),
  settimaneAntiRipetizione: integer('settimane_anti_ripetizione').notNull().default(3),
  // I dati del corpo servono a calcolare le porzioni invece di indovinarle.
  // Sono facoltativi: senza, restano le porzioni di riferimento del
  // vocabolario, e l'app funziona lo stesso.
  sesso: text('sesso'),
  eta: integer('eta'),
  altezza: integer('altezza'),
  pesoKg: numeric('peso_kg', { precision: 5, scale: 2 }),
  // sedentario, leggero, moderato, attivo, molto_attivo
  attivita: text('attivita'),
  // mantenere, dimagrire, massa
  obiettivo: text('obiettivo'),
  // Le etichette attenuate invece che escluse: non tolgono l'alimento, lo
  // spostano. Il glutine si riduce - una fonte per pasto - e il lattosio si
  // sostituisce col gemello delattosato. Il modo sta in
  // apps/web/lib/nutrizione/attenuazioni.ts.
  attenuazioni: jsonb('attenuazioni').$type<string[]>().notNull().default([]),
  // Le condizioni di salute accese: hashimoto, colesterolo, pressione...
  // Non escludono niente in modo rigido, spostano i pesi. Vedi
  // apps/web/lib/nutrizione/condizioni.ts.
  condizioni: jsonb('condizioni').$type<string[]>().notNull().default([]),
  // Le singole regole spente, come "hashimoto.soia": una condizione si accende
  // tutta e poi si smonta pezzo per pezzo.
  regoleSpente: jsonb('regole_spente').$type<string[]>().notNull().default([]),
  aggiornatoIl: timestamp('aggiornato_il', { withTimezone: true }).notNull().defaultNow(),
})

export type Profilo = typeof profilo.$inferSelect

export const alimenti = pgTable(
  'alimenti',
  {
    id: serial('id').primaryKey(),
    nome: text('nome').notNull(),
    gruppo: text('gruppo').notNull(),
    // I ruoli che puo' coprire: base, proteina, verdura, grasso, frutta...
    ruoli: jsonb('ruoli').$type<string[]>().notNull().default([]),
    fasce: jsonb('fasce').$type<string[]>().notNull().default([]),
    quantita: integer('quantita').notNull(),
    unita: text('unita').notNull(),
    // lattosio, glutine, pane, maiale, carne_rossa, pesce, uova, frutta_guscio,
    // fritto, proteico, zuccheri. Sono queste che fanno scattare le esclusioni.
    etichette: jsonb('etichette').$type<string[]>().notNull().default([]),
    // Per 100g di prodotto crudo. Valori CREA, indicativi: servono a stimare
    // una giornata, non a certificarla.
    kcal: numeric('kcal', { precision: 7, scale: 2 }),
    proteine: numeric('proteine', { precision: 7, scale: 2 }),
    carboidrati: numeric('carboidrati', { precision: 7, scale: 2 }),
    grassi: numeric('grassi', { precision: 7, scale: 2 }),
    fibre: numeric('fibre', { precision: 7, scale: 2 }),
    // Il reparto ordina la lista della spesa sul percorso fisico nel negozio.
    reparto: text('reparto'),
    // I mesi in cui ha senso comprarlo, 1-12. Vuoto = tutto l'anno. Vale per
    // frutta e verdura: la pasta non ha stagione.
    mesiStagione: jsonb('mesi_stagione').$type<number[]>().notNull().default([]),
    // Si puo' mangiare e registrare, ma il piano lo propone di rado: salumi
    // grassi, fritti, dolci veri. Vedi alimenti/occasionali.ts.
    occasionale: boolean('occasionale').notNull().default(false),
  },
  (t) => [uniqueIndex('alimenti_nome_idx').on(t.nome)],
)

export type Alimento = typeof alimenti.$inferSelect
export type NuovoAlimento = typeof alimenti.$inferInsert


/**
 * Una lista di ingredienti: quello che puoi mangiare, per fascia, con i pesi.
 *
 * E' il centro dell'app. Si riempie in due modi che portano alla stessa
 * struttura: importando il PDF del nutrizionista, oppure scegliendo gli
 * alimenti a mano. Andare dal nutrizionista non e' un requisito.
 */
export const liste = pgTable('liste', {
  id: serial('id').primaryKey(),
    utenteId: integer('utente_id').references(() => utenti.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  // 'pdf' oppure 'manuale': serve solo a raccontare da dove viene.
  origine: text('origine').notNull().default('manuale'),
  dataVisita: date('data_visita'),
  attiva: boolean('attiva').notNull().default(false),
  creatoIl: timestamp('creato_il', { withTimezone: true }).notNull().defaultNow(),
})

export type Lista = typeof liste.$inferSelect

/**
 * Una voce della lista: un'alternativa ammessa, dentro una riga di un pasto.
 *
 * Le voci con lo stesso `riga` sono alternative fra loro - e' la struttura che
 * usa il nutrizionista quando scrive "Riso 80g o Pasta 80g". `testoGrezzo`
 * tiene quello che c'era scritto nel PDF: quando l'import non riconosce una
 * voce non la butta, la mostra com'era e la colleghi tu.
 */
export const listaVoci = pgTable(
  'lista_voci',
  {
    id: serial('id').primaryKey(),
    listaId: integer('lista_id')
      .notNull()
      .references(() => liste.id, { onDelete: 'cascade' }),
    // 'standard' quando non si distingue, oppure 'on' / 'off' per allenamento.
    giorno: text('giorno').notNull().default('standard'),
    fascia: text('fascia').notNull(),
    riga: integer('riga').notNull(),
    ordine: integer('ordine').notNull().default(0),
    alimentoId: integer('alimento_id').references(() => alimenti.id, { onDelete: 'set null' }),
    testoGrezzo: text('testo_grezzo'),
    quantita: numeric('quantita', { precision: 8, scale: 2 }).notNull(),
    unita: text('unita').notNull().default('g'),
  },
  (t) => [index('lista_voci_lista_idx').on(t.listaId, t.giorno, t.fascia)],
)

export type ListaVoce = typeof listaVoci.$inferSelect
export type NuovaListaVoce = typeof listaVoci.$inferInsert

/**
 * Un giorno reale. L'obiettivo si **fotografa** qui invece di ricalcolarlo:
 * se fra un mese cambi la lista, lo storico deve restare confrontabile con
 * quello che valeva allora.
 */
export const giornate = pgTable(
  'giornate',
  {
    id: serial('id').primaryKey(),
    utenteId: integer('utente_id').references(() => utenti.id, { onDelete: 'cascade' }),
    data: date('data').notNull(),
    tipoGiorno: text('tipo_giorno').notNull().default('standard'),
    listaId: integer('lista_id').references(() => liste.id, { onDelete: 'set null' }),
    obiettivo: jsonb('obiettivo')
      .$type<{ kcal: number; proteine: number; carboidrati: number; grassi: number }>()
      .notNull()
      .default({ kcal: 0, proteine: 0, carboidrati: 0, grassi: 0 }),
    creatoIl: timestamp('creato_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('giornate_data_idx').on(t.utenteId, t.data)],
)

export type Giornata = typeof giornate.$inferSelect

/** Un pasto di una giornata: cosa era previsto e cosa hai mangiato davvero. */
export const giornataPasti = pgTable(
  'giornata_pasti',
  {
    id: serial('id').primaryKey(),
    giornataId: integer('giornata_id')
      .notNull()
      .references(() => giornate.id, { onDelete: 'cascade' }),
    fascia: text('fascia').notNull(),
    // 'previsto' | 'mangiato' | 'saltato' | 'fuori_piano'
    stato: text('stato').notNull().default('previsto'),
    bloccato: boolean('bloccato').notNull().default(false),
    previsti: jsonb('previsti')
      .$type<
        {
          ruolo: string
          alimentoId: number | null
          nome: string
          quantita: number
          unita: string
          // Vero quando la dose e' piu' bassa di quella della ricetta. Facoltativo
          // perche' le giornate composte prima non ce l'hanno, e vanno lette lo stesso.
          ridotto?: boolean
        }[]
      >()
      .notNull()
      .default([]),
    consumati: jsonb('consumati')
      .$type<{ alimentoId: number | null; nome: string; quantita: number; unita: string; kcal: number; proteine: number; carboidrati: number; grassi: number }[]>()
      .notNull()
      .default([]),
    // La ricetta del ricettario di casa, che non sta nel database: e' un id di
    // testo dentro apps/web/lib/ricettario/libro.ts. Qui si salva solo quale
    // hai scelto, perche' "cambia ricetta" non deve ricomporre il pasto.
    ricettaLibro: text('ricetta_libro'),
    registratoIl: timestamp('registrato_il', { withTimezone: true }),
  },
  (t) => [uniqueIndex('giornata_pasti_posto_idx').on(t.giornataId, t.fascia)],
)

export type GiornataPasto = typeof giornataPasti.$inferSelect

/** Cosa c'e' gia' in casa: viene sottratto dalla lista della spesa. */
export const dispensa = pgTable(
  'dispensa',
  {
    id: serial('id').primaryKey(),
    utenteId: integer('utente_id').references(() => utenti.id, { onDelete: 'cascade' }),
    alimentoId: integer('alimento_id')
      .notNull()
      .references(() => alimenti.id, { onDelete: 'cascade' }),
    quantita: numeric('quantita', { precision: 8, scale: 2 }).notNull(),
    unita: text('unita').notNull().default('g'),
    aggiornatoIl: timestamp('aggiornato_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('dispensa_alimento_idx').on(t.utenteId, t.alimentoId)],
)

export type VoceDispensa = typeof dispensa.$inferSelect

/**
 * La lista della spesa e' derivata dal piano e non si salva. Si salva solo
 * cosa hai gia' messo nel carrello, per settimana.
 */
export const spesaSpuntati = pgTable(
  'spesa_spuntati',
  {
    id: serial('id').primaryKey(),
    utenteId: integer('utente_id').references(() => utenti.id, { onDelete: 'cascade' }),
    settimana: date('settimana').notNull(),
    alimentoId: integer('alimento_id').references(() => alimenti.id, { onDelete: 'cascade' }),
    vocelibera: text('voce_libera'),
    spuntato: boolean('spuntato').notNull().default(true),
  },
  (t) => [index('spesa_spuntati_settimana_idx').on(t.utenteId, t.settimana)],
)

export type SpesaSpuntato = typeof spesaSpuntati.$inferSelect

/** Un peso, se decidi di tracciarlo. Serve al resoconto per la visita. */
export const pesi = pgTable(
  'pesi',
  {
    id: serial('id').primaryKey(),
    utenteId: integer('utente_id').references(() => utenti.id, { onDelete: 'cascade' }),
    data: date('data').notNull(),
    kg: numeric('kg', { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [uniqueIndex('pesi_data_idx').on(t.utenteId, t.data)],
)

export type Peso = typeof pesi.$inferSelect

/**
 * Un volantino caricato: una settimana, un'insegna, un punto vendita.
 *
 * Il punto vendita non e' un dettaglio. Conad e' una cooperativa e il
 * volantino cambia per cooperativa regionale e per negozio: senza il punto
 * vendita giusto i prezzi mostrati non sono quelli che paghi.
 */
export const volantini = pgTable(
  'volantini',
  {
    id: serial('id').primaryKey(),
    insegna: text('insegna').notNull(),
    puntoVendita: text('punto_vendita'),
    validoDal: date('valido_dal'),
    validoAl: date('valido_al'),
    nomeFile: text('nome_file'),
    caricatoIl: timestamp('caricato_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('volantini_validita_idx').on(t.validoAl)],
)

export type Volantino = typeof volantini.$inferSelect

/**
 * Una riga del volantino agganciata - forse - a un alimento del vocabolario.
 *
 * `confidenza` da 0 a 1 e' quanto ci crediamo. Sotto soglia l'offerta si
 * mostra come **da verificare**, mai come certa: un prezzo sbagliato mostrato
 * come sicuro e' peggio di nessun prezzo.
 */
export const offerte = pgTable(
  'offerte',
  {
    id: serial('id').primaryKey(),
    volantinoId: integer('volantino_id')
      .notNull()
      .references(() => volantini.id, { onDelete: 'cascade' }),
    rigaGrezza: text('riga_grezza').notNull(),
    nomeGrezzo: text('nome_grezzo').notNull(),
    marca: text('marca'),
    // "500 g", "1 l", "conf. 2 x 125 g": come sta scritto sul volantino.
    formato: text('formato'),
    prezzo: numeric('prezzo', { precision: 8, scale: 2 }).notNull(),
    // Al kg o al litro, che e' l'unico modo per confrontare due offerte.
    prezzoUnitario: numeric('prezzo_unitario', { precision: 8, scale: 2 }),
    unitaPrezzo: text('unita_prezzo'),
    alimentoId: integer('alimento_id').references(() => alimenti.id, { onDelete: 'set null' }),
    confidenza: numeric('confidenza', { precision: 3, scale: 2 }).notNull().default('0'),
    // Vero quando l'aggancio l'hai confermato tu: allora e' certo per sempre.
    confermato: boolean('confermato').notNull().default(false),
  },
  (t) => [
    index('offerte_volantino_idx').on(t.volantinoId),
    index('offerte_alimento_idx').on(t.alimentoId),
  ],
)

export type Offerta = typeof offerte.$inferSelect

/**
 * Un telefono che ha detto sì ai promemoria.
 *
 * L'endpoint e' l'indirizzo che il browser da' al server di push: e' unico
 * per installazione, e quando scade il server di push risponde 410 e la
 * riga si butta. Le chiavi sono quelle che cifrano il messaggio - senza,
 * nemmeno chi consegna la notifica puo' leggerla.
 */
export const iscrizioniPush = pgTable(
  'iscrizioni_push',
  {
    id: serial('id').primaryKey(),
    utenteId: integer('utente_id').references(() => utenti.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    creataIl: timestamp('creata_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('iscrizioni_push_endpoint_idx').on(t.endpoint)],
)

export type IscrizionePush = typeof iscrizioniPush.$inferSelect

/**
 * L'ultima volta che un promemoria e' partito.
 *
 * Serve a non mandarlo due volte: il worker chiama la rotta ogni ora, e senza
 * questa riga il promemoria della sera arriverebbe a ogni giro fino a
 * mezzanotte.
 */
export const promemoriaMandati = pgTable(
  'promemoria_mandati',
  {
    id: serial('id').primaryKey(),
    utenteId: integer('utente_id').references(() => utenti.id, { onDelete: 'cascade' }),
    genere: text('genere').notNull(),
    data: date('data').notNull(),
    mandatoIl: timestamp('mandato_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('promemoria_genere_data_idx').on(t.utenteId, t.genere, t.data)],
)
