import { and, eq, gte, inArray, sql } from 'drizzle-orm'

import {
  type Alimento,
  type Profilo,
  alimenti as tabellaAlimenti,
  db,
  piani,
  pianiPasti,
  profilo as tabellaProfilo,
  ricettaIngredienti,
  ricette,
} from '@prontooo/db'
import type { FasciaPasto } from '@prontooo/db/alimenti'

import { type Componente, ammesso, componiPasto } from '../nutrizione/componi'
import { impostazione as leggiImpostazione } from '../nutrizione/impostazioni'
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
  esclusioni: [],
  impostazione: 'equilibrata',
  alimentiScelti: [],
  settimaneAntiRipetizione: 3,
}

export async function leggiProfilo(): Promise<Profilo | null> {
  const [riga] = await db().select().from(tabellaProfilo).where(eq(tabellaProfilo.id, 1)).limit(1)

  return riga ?? null
}

export async function leggiAlimenti(): Promise<Alimento[]> {
  return db().select().from(tabellaAlimenti).orderBy(tabellaAlimenti.nome)
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

/** Gli alimenti che il profilo ammette: esclusioni del wizard piu' quelle dell'impostazione. */
export function alimentiAmmessi(tutti: Alimento[], profilo: Profilo): Alimento[] {
  const escluse = new Set([
    ...profilo.esclusioni,
    ...(leggiImpostazione(profilo.impostazione).escludi ?? []),
  ])

  return tutti.filter((a) => ammesso(a, escluse))
}

/**
 * Cerca in catalogo una ricetta che usi il componente principale del pasto.
 *
 * E' un suggerimento, non una prescrizione: la corrispondenza e' sul testo
 * grezzo della riga ingrediente, quindi va mostrata come un'idea. Quando
 * arrivera' la normalizzazione degli ingredienti questa funzione diventera'
 * seria; per ora vale quanto vale, e la UI lo dice.
 */
async function ideaRicetta(fascia: Fascia, componenti: Componente[]): Promise<number | null> {
  const principale =
    componenti.find((c) => c.ruolo === 'proteina') ?? componenti.find((c) => c.ruolo === 'base')

  if (!principale) return null

  // "Petto di pollo" -> "pollo": la parola piu' lunga e' quella che conta.
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

type Preparato = { componenti: Componente[]; ricettaId: number | null }

async function preparaPasto(
  fascia: Fascia,
  disponibili: Alimento[],
  profilo: Profilo,
  giaUsati: Set<number>,
): Promise<Preparato | null> {
  const composto = componiPasto(fascia as FasciaPasto, disponibili, {
    esclusioni: profilo.esclusioni,
    impostazione: profilo.impostazione,
    alimentiScelti: profilo.alimentiScelti,
    porzioni: profilo.porzioniDefault,
  }, giaUsati)

  if (!composto) return null

  return { componenti: composto.componenti, ricettaId: await ideaRicetta(fascia, composto.componenti) }
}

/**
 * Genera o rigenera la settimana. I pasti bloccati restano dove sono: e' il
 * "blocca e rigenera" - fissi quello che ti piace e ripeschi solo il resto.
 */
export async function generaPiano(inizio = lunediDi()): Promise<number> {
  const profilo = (await leggiProfilo()) ?? { ...PROFILO_PREDEFINITO, aggiornatoIl: new Date() }
  const disponibili = alimentiAmmessi(await leggiAlimenti(), profilo)
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
  const daCancellare = esistenti.filter((p) => !p.bloccato).map((p) => p.id)

  if (daCancellare.length > 0) {
    await connessione.delete(pianiPasti).where(inArray(pianiPasti.id, daCancellare))
  }

  const occupate = new Set(bloccati.map((p) => `${p.giorno}:${p.fascia}`))

  // Gli alimenti usati oggi: evita la giornata con tre volte lo stesso pollo.
  const usatiPerGiorno = new Map<number, Set<number>>()

  for (const p of bloccati) {
    const insieme = usatiPerGiorno.get(p.giorno) ?? new Set<number>()
    p.componenti.forEach((c) => insieme.add(c.alimentoId))
    usatiPerGiorno.set(p.giorno, insieme)
  }

  for (const posto of caselle(profilo)) {
    if (occupate.has(`${posto.giorno}:${posto.fascia}`)) continue

    const usatiOggi = usatiPerGiorno.get(posto.giorno) ?? new Set<number>()
    const preparato = await preparaPasto(posto.fascia, disponibili, profilo, usatiOggi)

    preparato?.componenti.forEach((c) => usatiOggi.add(c.alimentoId))
    usatiPerGiorno.set(posto.giorno, usatiOggi)

    await connessione.insert(pianiPasti).values({
      pianoId: piano.id,
      giorno: posto.giorno,
      fascia: posto.fascia,
      porzioni: profilo.porzioniDefault,
      componenti: preparato?.componenti ?? [],
      ricettaId: preparato?.ricettaId ?? null,
    })
  }

  return piano.id
}

/** Ricompone una sola casella, restando nella sua fascia. */
export async function cambiaPasto(pastoId: number): Promise<void> {
  const connessione = db()

  const [pasto] = await connessione
    .select()
    .from(pianiPasti)
    .where(eq(pianiPasti.id, pastoId))
    .limit(1)

  if (!pasto || !eFascia(pasto.fascia)) return

  const profilo = (await leggiProfilo()) ?? { ...PROFILO_PREDEFINITO, aggiornatoIl: new Date() }
  const disponibili = alimentiAmmessi(await leggiAlimenti(), profilo)

  // Gli alimenti di adesso restano fuori: cambiare deve cambiare qualcosa.
  const attuali = new Set(pasto.componenti.map((c) => c.alimentoId))
  const preparato = await preparaPasto(pasto.fascia, disponibili, profilo, attuali)

  if (!preparato) return

  await connessione
    .update(pianiPasti)
    .set({ componenti: preparato.componenti, ricettaId: preparato.ricettaId })
    .where(eq(pianiPasti.id, pastoId))
}

/** Il piano della settimana, pronto da mostrare. */
export async function leggiPiano(inizio = lunediDi()) {
  const [piano] = await db().select().from(piani).where(eq(piani.inizioSettimana, inizio)).limit(1)

  if (!piano) return null

  const pasti = await db()
    .select({
      id: pianiPasti.id,
      giorno: pianiPasti.giorno,
      fascia: pianiPasti.fascia,
      porzioni: pianiPasti.porzioni,
      bloccato: pianiPasti.bloccato,
      componenti: pianiPasti.componenti,
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

