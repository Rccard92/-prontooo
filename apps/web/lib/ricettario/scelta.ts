import { inArray } from 'drizzle-orm'

import { alimenti, db } from '@prontooo/db'

import type { Componente } from '../giornata/modello'
import { eFascia } from '../ricette/fasce'

import { LIBRO } from './libro'
import {
  type Abbinamento,
  type ComponenteAbbinabile,
  abbina,
  occorrente,
  passiDi,
} from './modello'

type DatiAlimento = { gruppo: string; etichette: string[] }

/** Gruppo ed etichette degli alimenti citati, in una sola lettura. */
async function leggiAlimenti(ids: number[]): Promise<Map<number, DatiAlimento>> {
  const unici = [...new Set(ids)]

  if (unici.length === 0) return new Map()

  const righe = await db()
    .select({ id: alimenti.id, gruppo: alimenti.gruppo, etichette: alimenti.etichette })
    .from(alimenti)
    .where(inArray(alimenti.id, unici))

  return new Map(righe.map((r) => [r.id, { gruppo: r.gruppo, etichette: r.etichette }]))
}

function unisci(componenti: Componente[], dati: Map<number, DatiAlimento>): ComponenteAbbinabile[] {
  return componenti.map((c) => {
    const alimento = c.alimentoId === null ? null : (dati.get(c.alimentoId) ?? null)

    return { ...c, gruppo: alimento?.gruppo ?? null, etichette: alimento?.etichette ?? [] }
  })
}

/** Aggiunge ai componenti il gruppo e le etichette, che stanno sull'alimento. */
export async function arricchisci(componenti: Componente[]): Promise<ComponenteAbbinabile[]> {
  const ids = componenti.map((c) => c.alimentoId).filter((i): i is number => i !== null)

  return unisci(componenti, await leggiAlimenti(ids))
}

/**
 * Le ricette del ricettario che si possono fare con questo pasto, in ordine.
 *
 * Prima quelle che calzano, poi le vicine, poi quelle a cui manca un pezzo.
 * A parita' di livello vince chi usa piu' componenti e ne lascia meno fuori.
 */
export function proposte(fascia: string, componenti: ComponenteAbbinabile[]): Abbinamento[] {
  if (!eFascia(fascia)) return []

  const ordine = { calza: 0, vicina: 1, adattabile: 2 }

  return LIBRO.filter((r) => r.fasce.includes(fascia))
    .map((r) => abbina(r, componenti))
    .filter((a): a is Abbinamento => a !== null)
    .sort((a, b) => ordine[a.livello] - ordine[b.livello] || b.punteggio - a.punteggio)
}

/** Da un abbinamento, la ricetta scritta coi grammi del pasto. */
function vestila(scelto: Abbinamento, elenco: Abbinamento[]) {
  return {
    id: scelto.ricetta.id,
    titolo: scelto.ricetta.titolo,
    minuti: scelto.ricetta.minuti,
    livello: scelto.livello,
    nota: scelto.ricetta.nota ?? null,
    occorrente: occorrente(scelto),
    passi: passiDi(scelto),
    mancanti: scelto.mancanti.map((p) => p.gruppi[0] ?? p.ruolo),
    avanzati: scelto.avanzati.map((c) => c.nome),
    alternative: elenco
      .filter((a) => a.ricetta.id !== scelto.ricetta.id)
      .slice(0, 6)
      .map((a) => ({ id: a.ricetta.id, titolo: a.ricetta.titolo, livello: a.livello })),
  }
}

export type RicettaDelPasto = ReturnType<typeof vestila>

function scegli(fascia: string, componenti: ComponenteAbbinabile[], scelta?: string | null) {
  const elenco = proposte(fascia, componenti)

  if (elenco.length === 0) return null

  const scelto = (scelta ? elenco.find((a) => a.ricetta.id === scelta) : null) ?? elenco[0]!

  return vestila(scelto, elenco)
}

/**
 * La ricetta del ricettario per un pasto gia' composto, pronta da mostrare.
 *
 * `scelta` fissa quale: senza, si prende la migliore. Serve al pulsante
 * "cambia ricetta", che deve poter scorrere le altre senza ricomporre il pasto.
 */
export async function ricettaDelPasto(
  fascia: string,
  componenti: Componente[],
  scelta?: string | null,
): Promise<RicettaDelPasto | null> {
  return scegli(fascia, await arricchisci(componenti), scelta)
}

export type PastoDaVestire = {
  id: number
  fascia: string
  previsti: Componente[]
  ricettaLibro: string | null
}

/** Le ricette di tutti i pasti del giorno, con una sola lettura del database. */
export async function ricetteDeiPasti(
  pasti: PastoDaVestire[],
): Promise<Map<number, RicettaDelPasto>> {
  const ids = pasti.flatMap((p) =>
    p.previsti.map((c) => c.alimentoId).filter((i): i is number => i !== null),
  )

  const dati = await leggiAlimenti(ids)
  const per = new Map<number, RicettaDelPasto>()

  for (const pasto of pasti) {
    const ricetta = scegli(pasto.fascia, unisci(pasto.previsti, dati), pasto.ricettaLibro)

    if (ricetta) per.set(pasto.id, ricetta)
  }

  return per
}

/**
 * La ricetta dopo quella attuale, per il pulsante "cambia ricetta".
 *
 * Gira in tondo: dall'ultima si torna alla prima. Senza `attuale` restituisce
 * la seconda, perche' la prima e' quella che stai gia' guardando.
 */
export async function ricettaSuccessiva(
  fascia: string,
  componenti: Componente[],
  attuale: string | null,
): Promise<string | null> {
  const elenco = proposte(fascia, await arricchisci(componenti))

  if (elenco.length < 2) return null

  const indice = attuale ? elenco.findIndex((a) => a.ricetta.id === attuale) : 0

  return elenco[(Math.max(indice, 0) + 1) % elenco.length]!.ricetta.id
}
