import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

let istanza: Db | undefined

/**
 * Connessione pigra: il build di Next non deve fallire quando DATABASE_URL
 * non c'e'. La connessione si apre alla prima query vera.
 */
export function db(): Db {
  if (istanza) return istanza

  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error('DATABASE_URL non impostata: il database non e collegato.')
  }

  const client = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  })

  istanza = drizzle(client, { schema })

  return istanza
}
