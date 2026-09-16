import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// In locale le variabili stanno in .env alla radice del monorepo.
// Su Railway arrivano dall'ambiente e questo non trova niente da caricare.
config({ path: ['../../.env', '.env'], quiet: true })

// `generate` legge solo lo schema e non apre connessioni: deve funzionare anche
// senza database. `migrate` e `studio` invece falliscono, ed e' giusto cosi'.
const url = process.env.DATABASE_URL ?? 'postgresql://utente@database-non-configurato:5432/cassetta'

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
