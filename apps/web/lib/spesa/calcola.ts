import { and, eq, gte, inArray, lte } from 'drizzle-orm'

import {
  type Alimento,
  alimenti,
  db,
  dispensa,
  giornataPasti,
  giornate,
  spesaSpuntati,
} from '@prontooo/db'
import { NOME_REPARTO, type Reparto } from '@prontooo/db/alimenti'

/**
 * La lista della spesa e' **derivata**, non salvata.
 *
 * Cambi un pasto e la lista cambia da sola: non c'e' nessun pulsante
 * "aggiorna" da ricordarsi di premere. Si salva soltanto cosa hai gia' messo
 * nel carrello.
 */
export type VoceSpesa = {
  alimentoId: number
  nome: string
  reparto: Reparto
  quantita: number
  unita: string
  inDispensa: number
  daComprare: number
  spuntato: boolean
}

export type GruppoSpesa = {
  reparto: Reparto
  nome: string
  voci: VoceSpesa[]
}

/** L'ordine in cui si cammina nel supermercato. */
const ORDINE_REPARTI: Reparto[] = [
  'ortofrutta',
  'macelleria',
  'pescheria',
  'frigo',
  'panetteria',
  'surgelati',
  'dispensa',
]

/** Il lunedi' della settimana di una data. */
export function lunediDi(data = new Date()): string {
  const romana = new Date(data.toLocaleString('en-US', { timeZone: 'Europe/Rome' }))
  const giorno = (romana.getDay() + 6) % 7

  romana.setDate(romana.getDate() - giorno)

  return `${romana.getFullYear()}-${String(romana.getMonth() + 1).padStart(2, '0')}-${String(romana.getDate()).padStart(2, '0')}`
}

function piuGiorni(data: string, quanti: number): string {
  const [a, m, g] = data.split('-').map(Number)
  const d = new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, (g ?? 1) + quanti))

  return d.toISOString().slice(0, 10)
}

/**
 * Arrotonda al formato di vendita: 330g di petto di pollo diventano una
 * confezione. Non e' preciso e non deve esserlo - serve a non farti comprare
 * "330 grammi" al banco.
 */
function arrotondaAllaConfezione(quantita: number, reparto: Reparto): number {
  if (reparto === 'ortofrutta') return Math.ceil(quantita / 50) * 50
  if (reparto === 'macelleria' || reparto === 'pescheria') return Math.ceil(quantita / 50) * 50

  return Math.ceil(quantita / 10) * 10
}

/** La lista della spesa di una settimana, gia' raggruppata per reparto. */
export async function listaSpesa(
  utenteId: number,
  settimana = lunediDi(),
): Promise<GruppoSpesa[]> {
  const connessione = db()
  const fine = piuGiorni(settimana, 6)

  const pasti = await connessione
    .select({ previsti: giornataPasti.previsti, stato: giornataPasti.stato })
    .from(giornataPasti)
    .innerJoin(giornate, eq(giornate.id, giornataPasti.giornataId))
    .where(
      and(
        eq(giornate.utenteId, utenteId),
        gte(giornate.data, settimana),
        lte(giornate.data, fine),
      ),
    )

  // Quello che hai gia' mangiato non si compra piu'.
  const componenti = pasti
    .filter((p) => p.stato === 'previsto')
    .flatMap((p) => p.previsti)
    .filter((c) => c.alimentoId !== null && c.quantita > 0)

  if (componenti.length === 0) return []

  const ids = [...new Set(componenti.map((c) => c.alimentoId!))]

  const [voci, inCasa, spuntati] = await Promise.all([
    connessione.select().from(alimenti).where(inArray(alimenti.id, ids)),
    connessione
      .select()
      .from(dispensa)
      .where(and(eq(dispensa.utenteId, utenteId), inArray(dispensa.alimentoId, ids))),
    connessione
      .select()
      .from(spesaSpuntati)
      .where(
        and(eq(spesaSpuntati.utenteId, utenteId), eq(spesaSpuntati.settimana, settimana)),
      ),
  ])

  const perId = new Map<number, Alimento>(voci.map((a) => [a.id, a]))
  const dispensaPer = new Map(inCasa.map((d) => [d.alimentoId, Number(d.quantita)]))
  const spuntatoPer = new Map(
    spuntati.filter((s) => s.alimentoId !== null).map((s) => [s.alimentoId!, s.spuntato]),
  )

  const totali = new Map<number, number>()

  for (const c of componenti) {
    totali.set(c.alimentoId!, (totali.get(c.alimentoId!) ?? 0) + c.quantita)
  }

  const risultato: VoceSpesa[] = []

  for (const [alimentoId, quantita] of totali) {
    const alimento = perId.get(alimentoId)

    if (!alimento) continue

    const reparto = (alimento.reparto as Reparto) ?? 'dispensa'
    const inDispensa = dispensaPer.get(alimentoId) ?? 0
    const netto = Math.max(0, quantita - inDispensa)

    if (netto === 0) continue

    risultato.push({
      alimentoId,
      nome: alimento.nome,
      reparto,
      quantita,
      unita: alimento.unita,
      inDispensa,
      daComprare: arrotondaAllaConfezione(netto, reparto),
      spuntato: spuntatoPer.get(alimentoId) ?? false,
    })
  }

  return ORDINE_REPARTI.map((reparto) => ({
    reparto,
    nome: NOME_REPARTO[reparto],
    voci: risultato
      .filter((v) => v.reparto === reparto)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
  })).filter((g) => g.voci.length > 0)
}
