import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Vocabolario degli allergeni.
 *
 * Regola di dominio: un allergene si attribuisce a una ricetta passando dagli
 * ingredienti canonici, mai dai tag dichiarati dalla fonte. Questa tabella e'
 * solo l'elenco chiuso dei codici ammessi; il legame ingrediente -> allergene
 * arriva in Fase 1 insieme a `ingredienti_canonici`.
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
