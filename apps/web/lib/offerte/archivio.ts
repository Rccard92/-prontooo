import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'

import { alimenti, db, offerte, volantini } from '@prontooo/db'

import { testoDelPdf } from '../lista/importa'

import { SOGLIA_CERTA, agganciaOfferta, eCerta } from './aggancia'
import { leggiVolantino } from './volantino'

export const INSEGNE = ['Lidl', 'Eurospin', 'Conad', 'Coop', 'Carrefour', 'MD', 'Altro'] as const
export type Insegna = (typeof INSEGNE)[number]

export type DatiVolantino = {
  insegna: string
  puntoVendita: string | null
  validoDal: string | null
  validoAl: string | null
  nomeFile: string | null
}

/**
 * Legge il PDF, aggancia le offerte al vocabolario e salva tutto.
 *
 * Qui si salva subito, al contrario della dieta: un volantino non ha grammi
 * che finiscono nel tuo piatto, e le offerte agganciate male sono gia'
 * segnate "da verificare" - si correggono dopo, guardando l'elenco.
 */
export async function importaVolantino(dati: ArrayBuffer, meta: DatiVolantino) {
  const testo = await testoDelPdf(dati)
  const righe = leggiVolantino(testo)

  if (righe.length === 0) {
    // Il volantino si registra lo stesso, con zero offerte. Due motivi: si
    // vede che l'abbiamo preso e non e' saltato, e il worker non torna a
    // riscaricarlo ogni giro - un PDF da decine di MB ogni dieci minuti.
    const [vuoto] = await db()
      .insert(volantini)
      .values({
        insegna: meta.insegna,
        puntoVendita: meta.puntoVendita,
        validoDal: meta.validoDal,
        validoAl: meta.validoAl,
        nomeFile: meta.nomeFile,
      })
      .returning({ id: volantini.id })

    // Serve a capire **perche'**: un volantino tutto immagini da un testo
    // vuoto, uno impaginato male da' testo a pezzi. Sono due problemi diversi
    // e dai log si distinguono.
    console.warn(
      `volantino ${meta.insegna}: nessuna offerta letta.` +
        ` Testo estratto: ${testo.length} caratteri.` +
        ` Assaggio: ${JSON.stringify(testo.replace(/\s+/g, ' ').slice(0, 500))}`,
    )

    return { volantinoId: vuoto?.id ?? null, quante: 0, certe: 0 }
  }

  const vocabolario = await db()
    .select({ id: alimenti.id, nome: alimenti.nome })
    .from(alimenti)
    .orderBy(asc(alimenti.nome))

  const [volantino] = await db()
    .insert(volantini)
    .values({
      insegna: meta.insegna,
      puntoVendita: meta.puntoVendita,
      validoDal: meta.validoDal,
      validoAl: meta.validoAl,
      nomeFile: meta.nomeFile,
    })
    .returning({ id: volantini.id })

  if (!volantino) return { volantinoId: null, quante: 0, certe: 0 }

  const daSalvare = righe.map((riga) => {
    const aggancio = agganciaOfferta(riga.nomeGrezzo, vocabolario)

    return {
      volantinoId: volantino.id,
      rigaGrezza: riga.rigaGrezza,
      nomeGrezzo: riga.nomeGrezzo,
      marca: riga.marca,
      formato: riga.formato,
      prezzo: riga.prezzo.toFixed(2),
      prezzoUnitario: riga.prezzoUnitario?.toFixed(2) ?? null,
      unitaPrezzo: riga.unitaPrezzo,
      alimentoId: aggancio?.alimentoId ?? null,
      confidenza: (aggancio?.confidenza ?? 0).toFixed(2),
    }
  })

  // A blocchi: un volantino di sessanta pagine fa centinaia di righe.
  for (let i = 0; i < daSalvare.length; i += 200) {
    await db().insert(offerte).values(daSalvare.slice(i, i + 200))
  }

  return {
    volantinoId: volantino.id,
    quante: daSalvare.length,
    certe: daSalvare.filter((o) => Number(o.confidenza) >= SOGLIA_CERTA).length,
  }
}

/** Un volantino e' valido finche' non scade. Senza data, vale un mese. */
function ancoraValido() {
  const oggi = new Date().toISOString().slice(0, 10)
  const unMeseFa = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  return or(gte(volantini.validoAl, oggi), and(isNull(volantini.validoAl), gte(volantini.caricatoIl, sql`${unMeseFa}::date`)))
}

export type OffertaPerAlimento = {
  id: number
  insegna: string
  puntoVendita: string | null
  nomeGrezzo: string
  marca: string | null
  formato: string | null
  prezzo: number
  prezzoUnitario: number | null
  unitaPrezzo: string | null
  confidenza: number
  certa: boolean
  validoAl: string | null
}

/**
 * Le offerte valide per un elenco di alimenti, la piu' conveniente per prima.
 *
 * Si confronta sul prezzo al kg quando c'e', perche' due formati diversi non
 * si confrontano sul prezzo pieno. Quando manca, si confronta sul prezzo e si
 * accetta che sia un confronto zoppo.
 */
export async function offertePerAlimenti(
  ids: number[],
): Promise<Map<number, OffertaPerAlimento[]>> {
  const unici = [...new Set(ids)]

  if (unici.length === 0) return new Map()

  const righe = await db()
    .select({
      id: offerte.id,
      alimentoId: offerte.alimentoId,
      nomeGrezzo: offerte.nomeGrezzo,
      marca: offerte.marca,
      formato: offerte.formato,
      prezzo: offerte.prezzo,
      prezzoUnitario: offerte.prezzoUnitario,
      unitaPrezzo: offerte.unitaPrezzo,
      confidenza: offerte.confidenza,
      confermato: offerte.confermato,
      insegna: volantini.insegna,
      puntoVendita: volantini.puntoVendita,
      validoAl: volantini.validoAl,
    })
    .from(offerte)
    .innerJoin(volantini, eq(volantini.id, offerte.volantinoId))
    .where(and(inArray(offerte.alimentoId, unici), ancoraValido()))

  const per = new Map<number, OffertaPerAlimento[]>()

  for (const r of righe) {
    if (r.alimentoId === null) continue

    const voce: OffertaPerAlimento = {
      id: r.id,
      insegna: r.insegna,
      puntoVendita: r.puntoVendita,
      nomeGrezzo: r.nomeGrezzo,
      marca: r.marca,
      formato: r.formato,
      prezzo: Number(r.prezzo),
      prezzoUnitario: r.prezzoUnitario === null ? null : Number(r.prezzoUnitario),
      unitaPrezzo: r.unitaPrezzo,
      confidenza: Number(r.confidenza),
      certa: eCerta(Number(r.confidenza), r.confermato),
      validoAl: r.validoAl,
    }

    per.set(r.alimentoId, [...(per.get(r.alimentoId) ?? []), voce])
  }

  for (const [id, voci] of per) {
    per.set(
      id,
      voci.sort((a, b) => {
        // Le certe prima: un'offerta da verificare non deve vincere il
        // confronto solo perche' costa meno di una che sappiamo giusta.
        if (a.certa !== b.certa) return a.certa ? -1 : 1

        return (a.prezzoUnitario ?? a.prezzo * 100) - (b.prezzoUnitario ?? b.prezzo * 100)
      }),
    )
  }

  return per
}

/** I volantini caricati, dal piu' recente. */
export async function volantiniCaricati() {
  return db()
    .select({
      id: volantini.id,
      insegna: volantini.insegna,
      puntoVendita: volantini.puntoVendita,
      validoDal: volantini.validoDal,
      validoAl: volantini.validoAl,
      caricatoIl: volantini.caricatoIl,
      quante: sql<number>`count(${offerte.id})::int`,
      agganciate: sql<number>`count(${offerte.alimentoId})::int`,
    })
    .from(volantini)
    .leftJoin(offerte, eq(offerte.volantinoId, volantini.id))
    .groupBy(volantini.id)
    .orderBy(desc(volantini.caricatoIl))
}

/** Le offerte da verificare: agganciate ma sotto soglia, o non agganciate. */
export async function daVerificare(limite = 60) {
  return db()
    .select({
      id: offerte.id,
      nomeGrezzo: offerte.nomeGrezzo,
      formato: offerte.formato,
      prezzo: offerte.prezzo,
      confidenza: offerte.confidenza,
      alimentoId: offerte.alimentoId,
      alimentoNome: alimenti.nome,
      insegna: volantini.insegna,
    })
    .from(offerte)
    .innerJoin(volantini, eq(volantini.id, offerte.volantinoId))
    .leftJoin(alimenti, eq(alimenti.id, offerte.alimentoId))
    .where(
      and(
        eq(offerte.confermato, false),
        sql`${offerte.confidenza} < ${SOGLIA_CERTA}`,
        sql`${offerte.alimentoId} is not null`,
        ancoraValido(),
      ),
    )
    .orderBy(desc(offerte.confidenza))
    .limit(limite)
}
