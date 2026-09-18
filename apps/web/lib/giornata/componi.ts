import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import {
  type Alimento,
  alimenti,
  db,
  giornataPasti,
  giornate,
  ricettaIngredienti,
  ricette,
} from '@prontooo/db'

import { vociDi, listaAttiva, righePerFascia } from '../lista/archivio'
import { arrotonda, nutrientiDi, obiettivoDa, sommaNutrienti } from '../lista/modello'
import { FASCE, eFascia } from '../ricette/fasce'

import { MOLTIPLICATORI, type Componente, type TipoGiorno, nutrientiConsumati } from './modello'
import { ricalibra, type PastoDaRicalibrare } from './ricalibra'

export function oggi(): string {
  const romana = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }))

  return `${romana.getFullYear()}-${String(romana.getMonth() + 1).padStart(2, '0')}-${String(romana.getDate()).padStart(2, '0')}`
}

function mescola<T>(elenco: T[]): T[] {
  const copia = [...elenco]

  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j]!, copia[i]!]
  }

  return copia
}

/** Il ruolo di un alimento dentro il pasto: il primo che copre. */
function ruoloDi(alimento: Alimento | null): string {
  return alimento?.ruoli[0] ?? 'base'
}

/**
 * Compone i pasti di un giorno dalla lista di ingredienti.
 *
 * Da ogni riga sceglie **una** alternativa a caso: sono equivalenti per
 * costruzione, le ha messe insieme il nutrizionista o tu. Il caso e' quello
 * che rende utile il pulsante "cambia".
 */
export async function componiGiorno(tipoGiorno: TipoGiorno) {
  const lista = await listaAttiva()

  if (!lista) return null

  const voci = await vociDi(lista.id)
  const moltiplicatori = MOLTIPLICATORI[tipoGiorno]

  const pasti = FASCE.map((fascia) => {
    const righe = righePerFascia(voci, fascia)

    const componenti: Componente[] = righe
      .map((riga) => {
        const scelta = mescola(riga.voci)[0]

        if (!scelta) return null

        const ruolo = ruoloDi(scelta.alimento)
        const base = Number(scelta.quantita)
        const fattore = moltiplicatori[ruolo] ?? 1

        return {
          ruolo,
          alimentoId: scelta.alimentoId,
          nome: scelta.alimento?.nome ?? scelta.testoGrezzo ?? 'Da collegare',
          // Le voci "a piacere" hanno quantita' zero e restano tali.
          quantita: base === 0 ? 0 : Math.max(5, Math.round((base * fattore) / 5) * 5),
          unita: scelta.unita,
        }
      })
      .filter((c): c is Componente => c !== null)

    return { fascia, componenti }
  }).filter((p) => p.componenti.length > 0)

  const obiettivo = arrotonda(
    sommaNutrienti(
      FASCE.map((fascia) => {
        const righe = righePerFascia(voci, fascia)
        const base = obiettivoDa(righe)
        // L'obiettivo del giorno tiene conto del tipo di giorno, altrimenti un
        // giorno ON risulterebbe sempre sopra soglia.
        const fattoreMedio = tipoGiorno === 'on' ? 1.12 : tipoGiorno === 'off' ? 0.92 : 1

        return {
          kcal: base.kcal * fattoreMedio,
          proteine: base.proteine,
          carboidrati: base.carboidrati * fattoreMedio,
          grassi: base.grassi * (tipoGiorno === 'on' ? 0.85 : 1),
          fibre: base.fibre,
        }
      }),
    ),
  )

  return { listaId: lista.id, pasti, obiettivo }
}

/** Le kcal di un elenco di componenti, leggendo gli alimenti dal database. */
export async function kcalDi(componenti: Componente[]): Promise<number> {
  const ids = [...new Set(componenti.map((c) => c.alimentoId).filter((id): id is number => id !== null))]

  if (ids.length === 0) return 0

  const righe = await db().select().from(alimenti).where(inArray(alimenti.id, ids))
  const per = new Map(righe.map((r) => [r.id, r]))

  return Math.round(
    componenti.reduce((t, c) => {
      const alimento = c.alimentoId === null ? null : (per.get(c.alimentoId) ?? null)

      return t + nutrientiDi(alimento, c.quantita).kcal
    }, 0),
  )
}

/** Crea o rigenera la giornata di una data, tenendo i pasti bloccati. */
export async function generaGiornata(data = oggi(), tipoGiorno?: TipoGiorno) {
  const connessione = db()

  const [esistente] = await connessione
    .select()
    .from(giornate)
    .where(eq(giornate.data, data))
    .limit(1)

  const tipo = tipoGiorno ?? ((esistente?.tipoGiorno as TipoGiorno) || 'standard')
  const composto = await componiGiorno(tipo)

  if (!composto) return null

  const [giornata] = await connessione
    .insert(giornate)
    .values({
      data,
      tipoGiorno: tipo,
      listaId: composto.listaId,
      obiettivo: composto.obiettivo,
    })
    .onConflictDoUpdate({
      target: giornate.data,
      set: { tipoGiorno: tipo, listaId: composto.listaId, obiettivo: composto.obiettivo },
    })
    .returning({ id: giornate.id })

  if (!giornata) return null

  const pastiEsistenti = await connessione
    .select()
    .from(giornataPasti)
    .where(eq(giornataPasti.giornataId, giornata.id))

  // Quello che hai gia' mangiato o tenuto fermo non si tocca.
  const intoccabili = new Set(
    pastiEsistenti.filter((p) => p.stato !== 'previsto' || p.bloccato).map((p) => p.fascia),
  )

  for (const pasto of composto.pasti) {
    if (intoccabili.has(pasto.fascia)) continue

    await connessione
      .insert(giornataPasti)
      .values({
        giornataId: giornata.id,
        fascia: pasto.fascia,
        previsti: pasto.componenti,
        ricettaId: await ideaRicetta(pasto.fascia, pasto.componenti),
      })
      .onConflictDoUpdate({
        target: [giornataPasti.giornataId, giornataPasti.fascia],
        set: {
          previsti: pasto.componenti,
          ricettaId: await ideaRicetta(pasto.fascia, pasto.componenti),
        },
      })
  }

  return giornata.id
}

/**
 * Cerca in catalogo una ricetta che usi il componente principale.
 *
 * E' un'idea, non una prescrizione: la corrispondenza e' sul testo grezzo
 * della riga ingrediente, e la UI lo dice.
 */
export async function ideaRicetta(fascia: string, componenti: Componente[]): Promise<number | null> {
  if (!eFascia(fascia)) return null

  const principale =
    componenti.find((c) => c.ruolo === 'proteina') ?? componenti.find((c) => c.ruolo === 'base')

  if (!principale) return null

  const parola = principale.nome
    .toLowerCase()
    .split(/[\s,()]+/)
    .filter((p) => p.length > 3)
    .sort((a, b) => b.length - a.length)[0]

  if (!parola) return null

  const righe = await db()
    .selectDistinct({ id: ricette.id })
    .from(ricette)
    .innerJoin(ricettaIngredienti, eq(ricettaIngredienti.ricettaId, ricette.id))
    .where(
      and(
        sql`${ricette.fasce} @> ${JSON.stringify([fascia])}::jsonb`,
        sql`lower(${ricettaIngredienti.rigaGrezza}) like ${'%' + parola + '%'}`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(1)

  return righe[0]?.id ?? null
}

/** La giornata con dentro i pasti, pronta da mostrare. */
export async function leggiGiornata(data = oggi()) {
  const [giornata] = await db().select().from(giornate).where(eq(giornate.data, data)).limit(1)

  if (!giornata) return null

  const pasti = await db()
    .select({
      id: giornataPasti.id,
      fascia: giornataPasti.fascia,
      stato: giornataPasti.stato,
      bloccato: giornataPasti.bloccato,
      previsti: giornataPasti.previsti,
      consumati: giornataPasti.consumati,
      ricettaId: ricette.id,
      titolo: ricette.titolo,
      immagineUrl: ricette.immagineUrl,
      minutiTotali: ricette.minutiTotali,
    })
    .from(giornataPasti)
    .leftJoin(ricette, eq(ricette.id, giornataPasti.ricettaId))
    .where(eq(giornataPasti.giornataId, giornata.id))
    .orderBy(asc(giornataPasti.id))

  const ordine = FASCE as readonly string[]
  const ordinati = [...pasti].sort((a, b) => ordine.indexOf(a.fascia) - ordine.indexOf(b.fascia))

  const consumato = nutrientiConsumati(ordinati.flatMap((p) => p.consumati))

  return { giornata, pasti: ordinati, consumato }
}

export { ricalibra, type PastoDaRicalibrare }
