import { and, eq, gte, sql } from 'drizzle-orm'

import { alimenti, db, giornataPasti, giornate, offerte, volantini } from '@prontooo/db'

import { SOGLIA_CERTA } from '../offerte/aggancia'

/**
 * I pesi con cui si sceglie fra alternative equivalenti.
 *
 * Il compositore, davanti a una riga con piu' alternative, ne pesca una. Fin
 * qui a caso. Qui il caso diventa informato da due cose, e da nessun'altra:
 *
 * 1. **cosa mangi davvero** - se spunti sempre il pollo e non tocchi mai il
 *    tacchino, dopo due mesi ha senso proporti piu' spesso il pollo
 * 2. **cosa e' in offerta** - a parita' di tutto, quello che costa meno
 *
 * Il punto importante: questo **non** allarga mai la scelta. Le alternative
 * sono quelle che stanno gia' nella tua lista, messe li' dal nutrizionista o
 * da te. I pesi cambiano solo con che frequenza escono, e un alimento con
 * peso basso esce lo stesso, ogni tanto - altrimenti dopo un mese mangeresti
 * sempre le stesse quattro cose.
 */
export type Pesi = Map<number, number>

/**
 * Sotto questa soglia di pasti registrati le abitudini non contano.
 *
 * Con dieci pasti in mano "mangi sempre il pollo" vuol dire che il pollo e'
 * uscito due volte. Non e' un'abitudine, e' il caso.
 */
export const PASTI_MINIMI = 40

const PESO_MASSIMO = 2.5
const PESO_MINIMO = 0.4

/**
 * Quanto conta un alimento occasionale.
 *
 * Basso, non zero: "ogni tanto" e' proprio il posto giusto per una salsiccia.
 * Se fosse zero tanto varrebbe toglierlo dal vocabolario, e allora non
 * potresti nemmeno registrare quello che hai mangiato davvero.
 */
const PESO_OCCASIONALE = 0.25

/** Quante volte ogni alimento e' finito in un pasto che hai spuntato. */
async function abitudini(utenteId: number): Promise<{ conteggi: Map<number, number>; pasti: number }> {
  const daQuando = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const righe = await db()
    .select({ consumati: giornataPasti.consumati })
    .from(giornataPasti)
    .innerJoin(giornate, eq(giornate.id, giornataPasti.giornataId))
    .where(
      and(
        eq(giornate.utenteId, utenteId),
        eq(giornataPasti.stato, 'mangiato'),
        gte(giornate.data, daQuando),
      ),
    )

  const conteggi = new Map<number, number>()

  for (const riga of righe) {
    for (const voce of riga.consumati) {
      if (voce.alimentoId === null) continue

      conteggi.set(voce.alimentoId, (conteggi.get(voce.alimentoId) ?? 0) + 1)
    }
  }

  return { conteggi, pasti: righe.length }
}

/** Gli alimenti che il piano propone di rado: salumi grassi, fritti, dolci. */
async function occasionali(): Promise<Set<number>> {
  const righe = await db()
    .select({ id: alimenti.id })
    .from(alimenti)
    .where(eq(alimenti.occasionale, true))

  return new Set(righe.map((r) => r.id))
}

/** Gli alimenti che questa settimana sono in offerta, con certezza. */
async function inOfferta(): Promise<Set<number>> {
  const oggi = new Date().toISOString().slice(0, 10)

  const righe = await db()
    .selectDistinct({ alimentoId: offerte.alimentoId })
    .from(offerte)
    .innerJoin(volantini, eq(volantini.id, offerte.volantinoId))
    .where(
      and(
        sql`${offerte.alimentoId} is not null`,
        sql`(${offerte.confermato} or ${offerte.confidenza} >= ${SOGLIA_CERTA})`,
        sql`(${volantini.validoAl} is null or ${volantini.validoAl} >= ${oggi}::date)`,
      ),
    )

  return new Set(righe.map((r) => r.alimentoId).filter((id): id is number => id !== null))
}

/**
 * Da quante volte hai mangiato una cosa, quanto spesso riproporla.
 *
 * Si confronta con la media, non col totale: cosi' la scala non dipende da
 * quanti giorni hai registrato.
 */
export function pesoDaAbitudine(volte: number, media: number): number {
  if (media <= 0) return 1

  const rapporto = volte / media

  return Math.min(PESO_MASSIMO, Math.max(PESO_MINIMO, 0.6 + rapporto * 0.5))
}

export async function pesiDiScelta(utenteId: number): Promise<Pesi> {
  const pesi: Pesi = new Map()

  const [{ conteggi, pasti }, offerti, diRado] = await Promise.all([
    abitudini(utenteId),
    inOfferta(),
    occasionali(),
  ])

  if (pasti >= PASTI_MINIMI && conteggi.size > 0) {
    const media = [...conteggi.values()].reduce((t, v) => t + v, 0) / conteggi.size

    for (const [id, volte] of conteggi) pesi.set(id, pesoDaAbitudine(volte, media))
  }

  // L'offerta inclina la scelta, non la decide: un terzo in piu' e basta.
  for (const id of offerti) pesi.set(id, (pesi.get(id) ?? 1) * 1.35)

  // L'occasionale schiaccia, e sta per ultimo apposta: nessuna abitudine e
  // nessuna offerta deve poter promuovere la mortadella a piatto fisso.
  for (const id of diRado) pesi.set(id, PESO_OCCASIONALE)

  return pesi
}

/**
 * Pesca una voce fra alternative equivalenti, tenendo conto dei pesi.
 *
 * `caso` sta fuori per poter essere fissato nei test: e' l'unica parte non
 * deterministica, e senza un modo di bloccarla il resto non si prova.
 */
export function scegliPesato<T extends { alimentoId: number | null }>(
  voci: T[],
  pesi: Pesi,
  caso = Math.random,
): T | null {
  if (voci.length === 0) return null
  if (voci.length === 1) return voci[0]!

  const conPeso = voci.map((voce) => ({
    voce,
    peso: voce.alimentoId === null ? 1 : (pesi.get(voce.alimentoId) ?? 1),
  }))

  const totale = conPeso.reduce((t, v) => t + v.peso, 0)

  if (totale <= 0) return voci[0]!

  let tiro = caso() * totale

  for (const { voce, peso } of conPeso) {
    tiro -= peso

    if (tiro < 0) return voce
  }

  return conPeso[conPeso.length - 1]!.voce
}
