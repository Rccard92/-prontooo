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
export const profilo = pgTable('profilo', {
  id: integer('id').primaryKey(),
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
  aggiornatoIl: timestamp('aggiornato_il', { withTimezone: true }).notNull().defaultNow(),
})

export type Profilo = typeof profilo.$inferSelect

/** Una settimana pianificata, identificata dal lunedi'. */
export const piani = pgTable(
  'piani',
  {
    id: serial('id').primaryKey(),
    inizioSettimana: date('inizio_settimana').notNull(),
    creatoIl: timestamp('creato_il', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('piani_inizio_settimana_idx').on(t.inizioSettimana)],
)

export type Piano = typeof piani.$inferSelect

/**
 * Un pasto del piano. `bloccato` e' quello che regge "blocca e rigenera":
 * rigenerando la settimana, i pasti bloccati restano dove sono.
 */
export const pianiPasti = pgTable(
  'piani_pasti',
  {
    id: serial('id').primaryKey(),
    pianoId: integer('piano_id')
      .notNull()
      .references(() => piani.id, { onDelete: 'cascade' }),
    giorno: integer('giorno').notNull(),
    fascia: text('fascia').notNull(),
    ricettaId: integer('ricetta_id').references(() => ricette.id, { onDelete: 'set null' }),
    porzioni: integer('porzioni').notNull().default(2),
    bloccato: boolean('bloccato').notNull().default(false),
    // Di cosa e' fatto il pasto: ruolo, alimento e grammi. E' questa la
    // sostanza; la ricetta, quando c'e', e' solo un modo di cucinarli.
    componenti: jsonb('componenti')
      .$type<{ ruolo: string; alimentoId: number; nome: string; quantita: number; unita: string }[]>()
      .notNull()
      .default([]),
  },
  (t) => [uniqueIndex('piani_pasti_posto_idx').on(t.pianoId, t.giorno, t.fascia)],
)

export type PianoPasto = typeof pianiPasti.$inferSelect

/**
 * Il vocabolario degli alimenti: cosa si compra e si mette in tavola, con la
 * porzione tipica e il ruolo che copre dentro un pasto.
 *
 * E' questo che permette di rispettare davvero "senza lattosio" o "senza
 * glutine": l'etichetta sta sull'alimento, non sulla ricetta. Il contenuto
 * arriva dal seed, non dall'utente.
 */
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
  },
  (t) => [uniqueIndex('alimenti_nome_idx').on(t.nome)],
)

export type Alimento = typeof alimenti.$inferSelect
export type NuovoAlimento = typeof alimenti.$inferInsert
