import {
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
    tipoPasto: text('tipo_pasto'),
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
