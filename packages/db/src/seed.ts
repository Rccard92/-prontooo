import { config } from 'dotenv'
import { asc, isNull, sql } from 'drizzle-orm'

import { NUTRIENTI } from './alimenti/nutrienti'
import { mesiDi } from './alimenti/stagioni'
import { VOCABOLARIO } from './alimenti/vocabolario'
import { db } from './client'
import {
  alimenti,
  allergeni,
  dispensa,
  giornate,
  liste,
  type NuovoAllergene,
  pesi,
  profilo,
  spesaSpuntati,
  utenti,
} from './schema'

config({ path: ['../../.env', '.env'], quiet: true })

/**
 * Elenco chiuso degli allergeni. Idempotente: gira a ogni deploy e non duplica.
 * I codici sono la chiave stabile usata dal resto dell'app, i nomi sono per la UI.
 */
const elenco: NuovoAllergene[] = [
  { codice: 'glutine', nome: 'Glutine', note: 'Occhio a salsa di soia, dado, seitan, molti insaccati' },
  { codice: 'lattosio', nome: 'Lattosio', note: 'Presente in pesto pronto, besciamella, molti salumi cotti' },
  { codice: 'uova', nome: 'Uova', note: 'Maionese, pasta all uovo, molti dolci' },
  { codice: 'frutta_a_guscio', nome: 'Frutta a guscio', note: 'Pesto, pralinati, pesti di pistacchio' },
  { codice: 'arachidi', nome: 'Arachidi', note: 'Distinte dalla frutta a guscio: sono legumi' },
  { codice: 'pesce', nome: 'Pesce', note: 'Colatura, salsa worcestershire, molti brodi pronti' },
  { codice: 'crostacei', nome: 'Crostacei' },
  { codice: 'molluschi', nome: 'Molluschi' },
  { codice: 'soia', nome: 'Soia', note: 'Lecitina di soia in moltissimi prodotti confezionati' },
  { codice: 'sedano', nome: 'Sedano', note: 'Base di quasi tutti i soffritti e dei dadi' },
  { codice: 'senape', nome: 'Senape' },
  { codice: 'sesamo', nome: 'Sesamo', note: 'Tahina, hummus, pane ai semi' },
  { codice: 'solfiti', nome: 'Solfiti', note: 'Vino, aceto, frutta secca' },
  { codice: 'lupini', nome: 'Lupini' },
]

/**
 * pgvector serve dalla Fase 5 per il matching offerta -> ingrediente. Meglio
 * scoprire adesso, nei log di deploy, se l'immagine Postgres non ce l'ha.
 */
async function verificaPgvector() {
  const righe = await db().execute(
    sql`select installed_version from pg_available_extensions where name = 'vector'`,
  )

  console.log(
    righe.length > 0
      ? 'pgvector: disponibile sull istanza'
      : 'pgvector: NON disponibile su questa immagine Postgres, la Fase 5 non potra funzionare',
  )
}

/**
 * Il vocabolario degli alimenti. Idempotente e aggiornante: il nome e' la
 * chiave, cosi' correggere un peso o un'etichetta nel file e ridistribuire
 * basta a sistemare il database.
 */
async function seedAlimenti() {
  const senzaNutrienti: string[] = []

  const righe = VOCABOLARIO.map((v) => {
    const n = NUTRIENTI.get(v.nome)

    if (!n) senzaNutrienti.push(v.nome)

    return {
      nome: v.nome,
      gruppo: v.gruppo,
      ruoli: v.ruoli as string[],
      fasce: v.fasce as string[],
      quantita: v.quantita,
      unita: v.unita,
      etichette: (v.etichette ?? []) as string[],
      kcal: n ? String(n.kcal) : null,
      proteine: n ? String(n.proteine) : null,
      carboidrati: n ? String(n.carboidrati) : null,
      grassi: n ? String(n.grassi) : null,
      fibre: n ? String(n.fibre) : null,
      reparto: n?.reparto ?? null,
      mesiStagione: mesiDi(v.nome),
    }
  })

  await db()
    .insert(alimenti)
    .values(righe)
    .onConflictDoUpdate({
      target: alimenti.nome,
      set: {
        gruppo: sql`excluded.gruppo`,
        ruoli: sql`excluded.ruoli`,
        fasce: sql`excluded.fasce`,
        quantita: sql`excluded.quantita`,
        unita: sql`excluded.unita`,
        etichette: sql`excluded.etichette`,
        kcal: sql`excluded.kcal`,
        proteine: sql`excluded.proteine`,
        carboidrati: sql`excluded.carboidrati`,
        grassi: sql`excluded.grassi`,
        fibre: sql`excluded.fibre`,
        reparto: sql`excluded.reparto`,
        mesiStagione: sql`excluded.mesi_stagione`,
      },
    })

  console.log(
    senzaNutrienti.length === 0
      ? `alimenti: ${righe.length} voci allineate, tutte con i valori nutrizionali`
      : `alimenti: ${righe.length} voci allineate, ${senzaNutrienti.length} SENZA valori nutrizionali: ${senzaNutrienti.join(', ')}`,
  )
}


/**
 * Adotta le righe rimaste senza proprietario.
 *
 * Prima del login c'era un utente solo e le sue righe non avevano
 * `utente_id`. Qui si assegnano al primo utente registrato. Se non c'e'
 * ancora nessuno non si fa niente: appena qualcuno si iscrive, il deploy
 * successivo le adotta. Se le righe orfane non ci sono - il caso normale
 * dopo la prima volta - questa funzione costa cinque conteggi e basta.
 */
async function adottaOrfane() {
  const connessione = db()

  const [primo] = await connessione
    .select({ id: utenti.id })
    .from(utenti)
    .orderBy(asc(utenti.id))
    .limit(1)

  if (!primo) return

  const tabelle = [
    ['liste', liste],
    ['giornate', giornate],
    ['dispensa', dispensa],
    ['spesa_spuntati', spesaSpuntati],
    ['pesi', pesi],
    ['profilo', profilo],
  ] as const

  let adottate = 0

  for (const [nome, tabella] of tabelle) {
    const righe = await connessione
      .update(tabella)
      .set({ utenteId: primo.id })
      .where(isNull(tabella.utenteId))
      .returning({ id: tabella.id })

    if (righe.length > 0) {
      console.log(`${nome}: ${righe.length} righe senza proprietario assegnate all utente ${primo.id}`)
      adottate += righe.length
    }
  }

  if (adottate === 0) return

  console.log(`adozione: ${adottate} righe in tutto`)
}

async function seed() {
  const inseriti = await db()
    .insert(allergeni)
    .values(elenco)
    .onConflictDoNothing({ target: allergeni.codice })
    .returning({ codice: allergeni.codice })

  await verificaPgvector()
  await seedAlimenti()
  await adottaOrfane()

  console.log(
    inseriti.length === 0
      ? `allergeni: gia presenti tutti e ${elenco.length}`
      : `allergeni: inseriti ${inseriti.length} su ${elenco.length}`,
  )
}

seed()
  .then(() => process.exit(0))
  .catch((errore) => {
    console.error('seed allergeni fallito:', errore)
    process.exit(1)
  })
