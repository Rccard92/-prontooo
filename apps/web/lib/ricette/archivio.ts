import { asc, eq, isNull, sql } from 'drizzle-orm'

import { alimenti, db, ricettaIngredienti, ricette } from '@prontooo/db'

import { chiaveConfigurata, leggiIngredienti } from './normalizza'
import { converti } from './posti'

/**
 * Normalizzare il catalogo, una ricetta alla volta.
 *
 * Le 419 ricette raccolte dai siti sono ferme in archivio per un motivo
 * preciso: non sappiamo cosa contengono. Finche' "320 g di pasta di semola" e'
 * una stringa, non c'e' modo di dire se dentro c'e' il glutine, ne' di
 * sostituire quei grammi coi tuoi. Sono ricette da guardare, non da usare.
 *
 * Qui smettono di esserlo. Ogni ricetta si legge **una volta sola** e il
 * risultato si salva: gli ingredienti diventano alimenti del vocabolario, le
 * etichette si sommano, e i ruoli diventano i **posti** che la fanno entrare
 * nel piano con la sua foto e il suo procedimento.
 */

export type EsitoNormalizzazione = {
  normalizzate: number
  convertite: number
  fallite: number
  restanti: number
}

/** Quante ne restano da leggere: serve al worker per sapere quando smettere. */
export async function daNormalizzare(): Promise<number> {
  const [riga] = await db()
    .select({ quante: sql<number>`count(*)::int` })
    .from(ricette)
    .where(isNull(ricette.normalizzataIl))

  return riga?.quante ?? 0
}

/** Il vocabolario ridotto a quello che serve per tradurre una riga. */
async function vocabolario() {
  return db()
    .select({
      id: alimenti.id,
      nome: alimenti.nome,
      gruppo: alimenti.gruppo,
      ruoli: alimenti.ruoli,
      etichette: alimenti.etichette,
    })
    .from(alimenti)
    .orderBy(asc(alimenti.nome))
}

/**
 * Legge le prossime `quante` ricette non ancora normalizzate.
 *
 * Un blocco alla volta, non tutte insieme: il vocabolario sta nella cache del
 * prompt e resta caldo fra una ricetta e l'altra, e se qualcosa va storto si
 * perde un blocco invece di un giro intero. Le ricette gia' fatte non si
 * ritoccano - `normalizzataIl` e' il segno che il lavoro e' stato fatto.
 */
export async function normalizzaProssime(quante: number): Promise<EsitoNormalizzazione> {
  if (!chiaveConfigurata()) {
    throw new Error('ANTHROPIC_API_KEY non configurata')
  }

  const connessione = db()

  const daFare = await connessione
    .select({ id: ricette.id, titolo: ricette.titolo })
    .from(ricette)
    .where(isNull(ricette.normalizzataIl))
    .orderBy(asc(ricette.id))
    .limit(Math.max(1, Math.min(quante, 50)))

  if (daFare.length === 0) {
    return { normalizzate: 0, convertite: 0, fallite: 0, restanti: 0 }
  }

  const vocaboli = await vocabolario()
  let normalizzate = 0
  let convertite = 0
  let fallite = 0

  for (const ricetta of daFare) {
    const righe = await connessione
      .select({
        id: ricettaIngredienti.id,
        posizione: ricettaIngredienti.posizione,
        rigaGrezza: ricettaIngredienti.rigaGrezza,
      })
      .from(ricettaIngredienti)
      .where(eq(ricettaIngredienti.ricettaId, ricetta.id))
      .orderBy(asc(ricettaIngredienti.posizione))

    // Una ricetta senza ingredienti non si puo' leggere, ma nemmeno si deve
    // riprovare per sempre: si segna fatta e resta in archivio.
    if (righe.length === 0) {
      await connessione
        .update(ricette)
        .set({ normalizzataIl: new Date(), posti: [], etichette: [] })
        .where(eq(ricette.id, ricetta.id))
      normalizzate += 1
      continue
    }

    let letti
    try {
      letti = await leggiIngredienti(
        righe.map((r) => r.rigaGrezza),
        vocaboli,
      )
    } catch (errore) {
      // Si lascia `normalizzataIl` nullo: la ricetta torna nel giro dopo.
      // Meglio riprovarla che segnarla fatta con dentro niente.
      console.error(`normalizzazione fallita per "${ricetta.titolo}":`, errore)
      fallite += 1
      continue
    }

    const esito = converti(letti)

    for (const [i, riga] of righe.entries()) {
      const letto = letti[i]

      if (!letto) continue

      await connessione
        .update(ricettaIngredienti)
        .set({
          alimentoId: letto.alimentoId,
          grammi: letto.grammi === null ? null : String(letto.grammi),
        })
        .where(eq(ricettaIngredienti.id, riga.id))
    }

    await connessione
      .update(ricette)
      .set({
        // I posti valgono solo se ho capito **tutte** le righe. Se una resta
        // sconosciuta non posso garantire le etichette, e una ricetta di cui
        // non garantisco le etichette non entra nel piano: resta sfogliabile.
        posti: esito.affidabile ? esito.posti : [],
        etichette: esito.etichette,
        normalizzataIl: new Date(),
      })
      .where(eq(ricette.id, ricetta.id))

    normalizzate += 1
    if (esito.affidabile && esito.posti.length > 0) convertite += 1
  }

  return { normalizzate, convertite, fallite, restanti: await daNormalizzare() }
}
