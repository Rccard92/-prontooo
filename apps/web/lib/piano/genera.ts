import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'

import {
  db,
  piani,
  pianiPasti,
  profilo as tabellaProfilo,
  ricettaIngredienti,
  ricette,
  type Profilo,
} from '@prontooo/db'

import { type Fascia, eFascia } from '../ricette/fasce'

import { lunediDi } from './settimana'

export const PROFILO_PREDEFINITO: Omit<Profilo, 'aggiornatoIl'> = {
  id: 1,
  adulti: 2,
  bambini: 0,
  porzioniDefault: 2,
  fasceAttive: ['colazione', 'pranzo', 'cena'],
  giorniFuoriPranzo: [],
  minutiMassimi: { colazione: 15, spuntino: 10, pranzo: 40, merenda: 15, cena: 45 },
  daEvitare: [],
  settimaneAntiRipetizione: 3,
}

export async function leggiProfilo(): Promise<Profilo | null> {
  const [riga] = await db().select().from(tabellaProfilo).where(eq(tabellaProfilo.id, 1)).limit(1)

  return riga ?? null
}

/** Le caselle da riempire: un posto per ogni giorno e ogni fascia attiva. */
export function caselle(profilo: Pick<Profilo, 'fasceAttive' | 'giorniFuoriPranzo'>) {
  const fasce = profilo.fasceAttive.filter(eFascia)
  const posti: { giorno: number; fascia: Fascia }[] = []

  for (let giorno = 0; giorno < 7; giorno += 1) {
    for (const fascia of fasce) {
      // I giorni in cui sei fuori a pranzo non entrano nel piano.
      if (fascia === 'pranzo' && profilo.giorniFuoriPranzo.includes(giorno)) continue

      posti.push({ giorno, fascia })
    }
  }

  return posti
}

/** Le ricette che contengono, nel testo grezzo, una delle cose da evitare. */
async function ricetteDaSaltare(daEvitare: string[]): Promise<number[]> {
  const termini = daEvitare.map((t) => t.trim()).filter(Boolean)

  if (termini.length === 0) return []

  const righe = await db()
    .selectDistinct({ id: ricettaIngredienti.ricettaId })
    .from(ricettaIngredienti)
    .where(
      or(...termini.map((t) => sql`lower(${ricettaIngredienti.rigaGrezza}) like ${'%' + t.toLowerCase() + '%'}`)),
    )

  return righe.map((r) => r.id)
}

/** Le ricette gia' usate nelle ultime settimane: servono per non ripetersi. */
async function ricetteRecenti(settimane: number): Promise<number[]> {
  if (settimane <= 0) return []

  const limite = new Date()
  limite.setDate(limite.getDate() - settimane * 7)
  const dal = limite.toISOString().slice(0, 10)

  const righe = await db()
    .selectDistinct({ id: pianiPasti.ricettaId })
    .from(pianiPasti)
    .innerJoin(piani, eq(piani.id, pianiPasti.pianoId))
    .where(gte(piani.inizioSettimana, dal))

  return righe.map((r) => r.id).filter((id): id is number => id !== null)
}

type Candidata = { id: number }

/**
 * Le ricette che possono stare in una fascia, gia' filtrate per tempo massimo.
 * L'ordine e' casuale: e' quello che rende "cambia ricetta" utile davvero.
 */
async function candidate(fascia: Fascia, minutiMassimi: number | undefined, escludi: number[]) {
  const condizioni = [sql`${ricette.fasce} @> ${JSON.stringify([fascia])}::jsonb`]

  if (minutiMassimi && minutiMassimi > 0) {
    // Una ricetta senza tempo dichiarato resta ammessa: scartarla toglierebbe
    // mezzo catalogo per un dato che manca, non per una ricetta troppo lunga.
    condizioni.push(or(isNull(ricette.minutiTotali), sql`${ricette.minutiTotali} <= ${minutiMassimi}`)!)
  }

  if (escludi.length > 0) {
    condizioni.push(sql`${ricette.id} not in ${escludi}`)
  }

  const righe: Candidata[] = await db()
    .select({ id: ricette.id })
    .from(ricette)
    .where(and(...condizioni))
    .orderBy(sql`random()`)
    .limit(40)

  return righe
}

/**
 * Sceglie una ricetta per una casella.
 *
 * Prova in tre passaggi, allargando ogni volta: prima rispettando tutto, poi
 * ammettendo le ricette gia' viste nelle settimane scorse, infine ignorando il
 * tempo massimo. Meglio una cena un po' piu' lunga che una casella vuota.
 */
async function scegli(
  fascia: Fascia,
  profilo: Profilo,
  giaNelPiano: number[],
  daSaltare: number[],
  recenti: number[],
): Promise<number | null> {
  const minuti = profilo.minutiMassimi[fascia]
  const tentativi: [number | undefined, number[]][] = [
    [minuti, [...giaNelPiano, ...daSaltare, ...recenti]],
    [minuti, [...giaNelPiano, ...daSaltare]],
    [undefined, [...giaNelPiano, ...daSaltare]],
  ]

  for (const [tetto, escludi] of tentativi) {
    const righe = await candidate(fascia, tetto, escludi)

    if (righe[0]) return righe[0].id
  }

  return null
}

/**
 * Genera o rigenera la settimana. I pasti bloccati restano dove sono: e' il
 * "blocca e rigenera" - fissi quello che ti piace e ripeschi solo il resto.
 */
export async function generaPiano(inizio = lunediDi()): Promise<number> {
  const profilo = (await leggiProfilo()) ?? { ...PROFILO_PREDEFINITO, aggiornatoIl: new Date() }
  const connessione = db()

  const [piano] = await connessione
    .insert(piani)
    .values({ inizioSettimana: inizio })
    .onConflictDoUpdate({ target: piani.inizioSettimana, set: { inizioSettimana: inizio } })
    .returning({ id: piani.id })

  if (!piano) throw new Error('creazione del piano fallita')

  const esistenti = await connessione
    .select()
    .from(pianiPasti)
    .where(eq(pianiPasti.pianoId, piano.id))

  const bloccati = esistenti.filter((p) => p.bloccato)
  const idBloccati = bloccati.map((p) => p.ricettaId).filter((id): id is number => id !== null)

  // Via tutto quello che non e' bloccato: si ripesca da capo.
  const daCancellare = esistenti.filter((p) => !p.bloccato).map((p) => p.id)

  if (daCancellare.length > 0) {
    await connessione.delete(pianiPasti).where(inArray(pianiPasti.id, daCancellare))
  }

  const daSaltare = await ricetteDaSaltare(profilo.daEvitare)
  const recenti = await ricetteRecenti(profilo.settimaneAntiRipetizione)
  const usate = [...idBloccati]

  const occupate = new Set(bloccati.map((p) => `${p.giorno}:${p.fascia}`))

  for (const posto of caselle(profilo)) {
    if (occupate.has(`${posto.giorno}:${posto.fascia}`)) continue

    const scelta = await scegli(posto.fascia, profilo, usate, daSaltare, recenti)

    if (scelta !== null) usate.push(scelta)

    await connessione.insert(pianiPasti).values({
      pianoId: piano.id,
      giorno: posto.giorno,
      fascia: posto.fascia,
      ricettaId: scelta,
      porzioni: profilo.porzioniDefault,
    })
  }

  return piano.id
}

/** Ripesca una sola casella, restando nella sua fascia. */
export async function cambiaPasto(pastoId: number): Promise<void> {
  const connessione = db()

  const [pasto] = await connessione
    .select()
    .from(pianiPasti)
    .where(eq(pianiPasti.id, pastoId))
    .limit(1)

  if (!pasto || !eFascia(pasto.fascia)) return

  const profilo = (await leggiProfilo()) ?? { ...PROFILO_PREDEFINITO, aggiornatoIl: new Date() }

  const altri = await connessione
    .select({ ricettaId: pianiPasti.ricettaId })
    .from(pianiPasti)
    .where(eq(pianiPasti.pianoId, pasto.pianoId))

  const giaNelPiano = altri.map((a) => a.ricettaId).filter((id): id is number => id !== null)
  const daSaltare = await ricetteDaSaltare(profilo.daEvitare)
  const recenti = await ricetteRecenti(profilo.settimaneAntiRipetizione)

  const scelta = await scegli(pasto.fascia, profilo, giaNelPiano, daSaltare, recenti)

  if (scelta === null) return

  await connessione
    .update(pianiPasti)
    .set({ ricettaId: scelta })
    .where(eq(pianiPasti.id, pastoId))
}

/** Il piano della settimana con dentro le ricette, pronto da mostrare. */
export async function leggiPiano(inizio = lunediDi()) {
  const [piano] = await db()
    .select()
    .from(piani)
    .where(eq(piani.inizioSettimana, inizio))
    .limit(1)

  if (!piano) return null

  const pasti = await db()
    .select({
      id: pianiPasti.id,
      giorno: pianiPasti.giorno,
      fascia: pianiPasti.fascia,
      porzioni: pianiPasti.porzioni,
      bloccato: pianiPasti.bloccato,
      ricettaId: ricette.id,
      titolo: ricette.titolo,
      immagineUrl: ricette.immagineUrl,
      minutiTotali: ricette.minutiTotali,
    })
    .from(pianiPasti)
    .leftJoin(ricette, eq(ricette.id, pianiPasti.ricettaId))
    .where(eq(pianiPasti.pianoId, piano.id))
    .orderBy(pianiPasti.giorno)

  return { piano, pasti }
}

export type PastoDelPiano = Awaited<ReturnType<typeof leggiPiano>> extends infer T
  ? T extends { pasti: (infer P)[] }
    ? P
    : never
  : never

export { desc }
