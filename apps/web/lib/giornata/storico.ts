import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'

import { db, giornataPasti, giornate } from '@prontooo/db'
import type { Nutrienti } from '@prontooo/db/alimenti'

import { FASCE } from '../ricette/fasce'

import { nutrientiConsumati } from './modello'

/**
 * Lo storico: cosa hai fatto davvero, non cosa avevi in programma.
 *
 * Serve a due cose e nessun'altra. A te, per vedere dove caschi sempre. Al
 * nutrizionista, che per aggiustare un piano deve sapere quanto lo hai
 * seguito e dove no: un piano seguito al 50% non si corregge, si riscrive.
 */
export type GiornoStorico = {
  data: string
  tipoGiorno: string
  obiettivo: Nutrienti | null
  consumato: Nutrienti
  pasti: {
    fascia: string
    stato: string
    titolo: string | null
    previsto: string | null
    kcal: number
  }[]
  registrati: number
  totali: number
}

/** "Al posto della cena prevista hai mangiato una pizza", contato. */
export type FuoriPiano = {
  fascia: string
  previsto: string
  mangiato: string
  quante: number
}

export type Settimana = {
  inizio: string
  giorni: number
  aderenza: number
  mediaKcal: number
}

export type RigaFascia = {
  fascia: string
  mangiati: number
  saltati: number
  fuori: number
  nonRegistrati: number
  aderenza: number
}

export type Resoconto = {
  giorni: GiornoStorico[]
  perFascia: RigaFascia[]
  /** Giorni in cui hai registrato almeno un pasto: il resto non dice niente. */
  giorniSeguiti: number
  mediaKcal: number
  aderenza: number
  /** La fascia dove caschi piu' spesso, se ce n'e' una che spicca. */
  puntoDebole: string | null
  /** Settimana per settimana: e' li' che si vede se stai migliorando. */
  settimane: Settimana[]
  /** Cosa hai mangiato al posto di cosa, dal caso piu' frequente. */
  fuoriPiano: FuoriPiano[]
  mediaProteine: number
  mediaCarboidrati: number
  mediaGrassi: number
}

/** La data di `quanti` giorni prima di `data`. */
function indietro(data: string, quanti: number): string {
  const [anno, mese, giorno] = data.split('-').map(Number)
  const d = new Date(Date.UTC(anno ?? 2026, (mese ?? 1) - 1, (giorno ?? 1) - quanti))

  return d.toISOString().slice(0, 10)
}

/** Il resoconto di un periodo, di base gli ultimi trenta giorni. */
export async function resoconto(giorni = 30, fine?: string): Promise<Resoconto> {
  const a = fine ?? new Date().toISOString().slice(0, 10)
  const da = indietro(a, giorni - 1)

  const righe = await db()
    .select({
      data: giornate.data,
      tipoGiorno: giornate.tipoGiorno,
      obiettivo: giornate.obiettivo,
      fascia: giornataPasti.fascia,
      stato: giornataPasti.stato,
      consumati: giornataPasti.consumati,
      previsti: giornataPasti.previsti,
    })
    .from(giornate)
    .leftJoin(giornataPasti, eq(giornataPasti.giornataId, giornate.id))
    .where(and(gte(giornate.data, da), lte(giornate.data, a)))
    .orderBy(desc(giornate.data), asc(giornataPasti.id))

  const perGiorno = new Map<string, GiornoStorico>()

  for (const r of righe) {
    const giorno = perGiorno.get(r.data) ?? {
      data: r.data,
      tipoGiorno: r.tipoGiorno,
      obiettivo: r.obiettivo as Nutrienti | null,
      consumato: nutrientiConsumati([]),
      pasti: [],
      registrati: 0,
      totali: 0,
    }

    if (r.fascia) {
      giorno.pasti.push({
        fascia: r.fascia,
        stato: r.stato ?? 'previsto',
        // Il titolo del pasto e' il suo componente principale: e' quello che
        // ti fa riconoscere la giornata scorrendo l'elenco.
        titolo: (r.consumati ?? []).map((c) => c.nome)[0] ?? (r.previsti ?? [])[0]?.nome ?? null,
        previsto: (r.previsti ?? [])[0]?.nome ?? null,
        kcal: Math.round((r.consumati ?? []).reduce((t, c) => t + c.kcal, 0)),
      })

      giorno.totali += 1

      if (r.stato !== 'previsto') giorno.registrati += 1
    }

    perGiorno.set(r.data, giorno)
  }

  // Le calorie si sommano a parte: la riga del pasto arriva una per fascia.
  for (const r of righe) {
    const giorno = perGiorno.get(r.data)

    if (!giorno || !r.consumati) continue

    const somma = nutrientiConsumati(r.consumati)

    giorno.consumato = {
      kcal: giorno.consumato.kcal + somma.kcal,
      proteine: giorno.consumato.proteine + somma.proteine,
      carboidrati: giorno.consumato.carboidrati + somma.carboidrati,
      grassi: giorno.consumato.grassi + somma.grassi,
      fibre: giorno.consumato.fibre + somma.fibre,
    }
  }

  const giorniTutti = [...perGiorno.values()]
  const seguiti = giorniTutti.filter((g) => g.registrati > 0)

  const perFascia: RigaFascia[] = FASCE.map((fascia) => {
    const pasti = seguiti.flatMap((g) => g.pasti.filter((p) => p.fascia === fascia))
    const mangiati = pasti.filter((p) => p.stato === 'mangiato').length
    const saltati = pasti.filter((p) => p.stato === 'saltato').length
    const fuori = pasti.filter((p) => p.stato === 'fuori_piano').length
    const nonRegistrati = pasti.filter((p) => p.stato === 'previsto').length

    return {
      fascia,
      mangiati,
      saltati,
      fuori,
      nonRegistrati,
      aderenza: pasti.length === 0 ? 0 : Math.round((mangiati / pasti.length) * 100),
    }
  }).filter((r) => r.mangiati + r.saltati + r.fuori + r.nonRegistrati > 0)

  const tuttiPasti = seguiti.flatMap((g) => g.pasti)
  const aderenza =
    tuttiPasti.length === 0
      ? 0
      : Math.round((tuttiPasti.filter((p) => p.stato === 'mangiato').length / tuttiPasti.length) * 100)

  const conKcal = seguiti.filter((g) => g.consumato.kcal > 0)

  // Una fascia e' il punto debole solo se sta davvero sotto le altre: dieci
  // punti di scarto, altrimenti e' rumore e non vale la pena dirlo.
  const ordinate = [...perFascia].sort((a, b) => a.aderenza - b.aderenza)
  const peggiore = ordinate[0]
  const media =
    perFascia.length === 0 ? 0 : perFascia.reduce((t, r) => t + r.aderenza, 0) / perFascia.length

  return {
    giorni: giorniTutti,
    perFascia,
    giorniSeguiti: seguiti.length,
    mediaKcal:
      conKcal.length === 0
        ? 0
        : Math.round(conKcal.reduce((t, g) => t + g.consumato.kcal, 0) / conKcal.length),
    aderenza,
    puntoDebole: peggiore && media - peggiore.aderenza >= 10 ? peggiore.fascia : null,
    settimane: perSettimana(seguiti),
    fuoriPiano: contaFuoriPiano(seguiti),
    mediaProteine: mediaDi(conKcal, 'proteine'),
    mediaCarboidrati: mediaDi(conKcal, 'carboidrati'),
    mediaGrassi: mediaDi(conKcal, 'grassi'),
  }
}

function mediaDi(giorni: GiornoStorico[], campo: keyof Nutrienti): number {
  if (giorni.length === 0) return 0

  return Math.round(giorni.reduce((t, g) => t + g.consumato[campo], 0) / giorni.length)
}

/** Il lunedi' della settimana di una data. */
function lunediDi(data: string): string {
  const [a, m, g] = data.split('-').map(Number)
  const d = new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, g ?? 1))

  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))

  return d.toISOString().slice(0, 10)
}

/**
 * Settimana per settimana.
 *
 * Il numero di un mese intero non dice se stai migliorando o peggiorando, e
 * quello e' esattamente cio' che serve sapere alla visita.
 */
function perSettimana(giorni: GiornoStorico[]): Settimana[] {
  const per = new Map<string, GiornoStorico[]>()

  for (const giorno of giorni) {
    const inizio = lunediDi(giorno.data)

    per.set(inizio, [...(per.get(inizio) ?? []), giorno])
  }

  return [...per.entries()]
    .map(([inizio, suoi]) => {
      const pasti = suoi.flatMap((g) => g.pasti)
      const conKcal = suoi.filter((g) => g.consumato.kcal > 0)

      return {
        inizio,
        giorni: suoi.length,
        aderenza:
          pasti.length === 0
            ? 0
            : Math.round((pasti.filter((p) => p.stato === 'mangiato').length / pasti.length) * 100),
        mediaKcal:
          conKcal.length === 0
            ? 0
            : Math.round(conKcal.reduce((t, g) => t + g.consumato.kcal, 0) / conKcal.length),
      }
    })
    .sort((a, b) => b.inizio.localeCompare(a.inizio))
}

/**
 * Cosa hai mangiato al posto di cosa, dal caso piu' frequente.
 *
 * E' la riga piu' utile del resoconto: un pasto saltato una volta e' la vita,
 * lo stesso pasto sostituito dalla stessa cosa per tre settimane e' il piano
 * che non ti sta bene, e va cambiato quello.
 */
function contaFuoriPiano(giorni: GiornoStorico[]): FuoriPiano[] {
  const conta = new Map<string, FuoriPiano>()

  for (const giorno of giorni) {
    for (const pasto of giorno.pasti) {
      if (pasto.stato !== 'fuori_piano' && pasto.stato !== 'saltato') continue

      const previsto = pasto.previsto ?? 'quello che c\'era'
      const mangiato = pasto.stato === 'saltato' ? 'niente, saltato' : (pasto.titolo ?? 'altro')
      const chiave = `${pasto.fascia}|${previsto}|${mangiato}`
      const gia = conta.get(chiave)

      conta.set(
        chiave,
        gia
          ? { ...gia, quante: gia.quante + 1 }
          : { fascia: pasto.fascia, previsto, mangiato, quante: 1 },
      )
    }
  }

  return [...conta.values()].sort((a, b) => b.quante - a.quante).slice(0, 12)
}
