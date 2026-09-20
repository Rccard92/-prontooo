import { and, inArray, isNotNull, sql } from 'drizzle-orm'

import { alimenti, db, ricette } from '@prontooo/db'

import type { Componente } from '../giornata/modello'
import { eFascia } from '../ricette/fasce'

import { LIBRO } from './libro'
import {
  type Abbinamento,
  type ComponenteAbbinabile,
  type RicettaComponibile,
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

/** Le ricette del catalogo che sono diventate componibili, senza i passi. */
export const DAL_CATALOGO = 'catalogo-'

/**
 * Le ricette del catalogo che la normalizzazione ha convertito.
 *
 * Solo quelle con dei posti: una ricetta con `posti` vuoto o non e' ancora
 * stata letta, o l'abbiamo letta e c'era dentro una riga che non abbiamo
 * capito. In tutti e due i casi non entra nel piano - resta sfogliabile su
 * `/ricette`, che e' quello per cui il catalogo e' nato.
 *
 * I passi non si leggono qui. Sono il campo piu' pesante della riga e servono
 * a **una** ricetta - quella scelta - non a tutte le candidate: caricarli per
 * duecento ricette a ogni apertura della pagina di oggi sarebbe mezzo mega
 * per niente.
 */
export async function catalogoComponibile(): Promise<RicettaComponibile[]> {
  const righe = await db()
    .select({
      id: ricette.id,
      titolo: ricette.titolo,
      fasce: ricette.fasce,
      minuti: ricette.minutiTotali,
      posti: ricette.posti,
      immagineUrl: ricette.immagineUrl,
      fonteNome: ricette.fonteNome,
      fonteUrl: ricette.fonteUrl,
    })
    .from(ricette)
    .where(
      and(isNotNull(ricette.normalizzataIl), sql`jsonb_array_length(${ricette.posti}) > 0`),
    )

  return righe.map((r) => ({
    // Il prefisso tiene separati i due mondi: `giornata_pasti.ricetta_libro`
    // salva questa stringa, e senza prefisso l'id 12 del catalogo e l'id 12
    // del libro sarebbero la stessa cosa.
    id: `${DAL_CATALOGO}${r.id}`,
    titolo: r.titolo,
    fasce: r.fasce.filter(eFascia),
    minuti: r.minuti ?? 0,
    posti: r.posti,
    passi: [],
    immagineUrl: r.immagineUrl,
    fonte: { nome: r.fonteNome, url: r.fonteUrl },
  }))
}

/** I passi di una ricetta del catalogo: si leggono solo per quella scelta. */
async function passiDalCatalogo(id: string): Promise<string[]> {
  const numero = Number(id.slice(DAL_CATALOGO.length))

  if (!Number.isInteger(numero)) return []

  const [riga] = await db()
    .select({ passaggi: ricette.passaggi })
    .from(ricette)
    .where(inArray(ricette.id, [numero]))
    .limit(1)

  return riga?.passaggi ?? []
}

/**
 * Le ricette che si possono fare con questo pasto, in ordine.
 *
 * Prima quelle che calzano, poi le vicine, poi quelle a cui manca un pezzo.
 * A parita' di livello vince chi usa piu' componenti e ne lascia meno fuori.
 *
 * `catalogo` sono le ricette raccolte dai siti che la normalizzazione ha
 * convertito in ricette a posti: arrivano da fuori ma qui dentro valgono
 * quanto quelle scritte a mano, perche' ormai parlano la stessa lingua.
 */
export function proposte(
  fascia: string,
  componenti: ComponenteAbbinabile[],
  catalogo: RicettaComponibile[] = [],
): Abbinamento[] {
  if (!eFascia(fascia)) return []

  const ordine = { calza: 0, vicina: 1, adattabile: 2 }

  return [...LIBRO, ...catalogo]
    .filter((r) => r.fasce.includes(fascia))
    .map((r) => abbina(r, componenti))
    .filter((a): a is Abbinamento => a !== null)
    .sort(
      (a, b) =>
        ordine[a.livello] - ordine[b.livello] ||
        b.punteggio - a.punteggio ||
        concretezza(b.ricetta) - concretezza(a.ricetta),
    )
}

/**
 * Quanto una ricetta e' una ricetta vera, e non un'impalcatura.
 *
 * Serve solo a decidere i pari merito, e li decide quasi tutti: il libro
 * scritto a mano e' fatto sugli stessi posti del compositore, quindi calza
 * sempre e calza uguale a una ricetta del catalogo che calza. Con
 * l'ordinamento stabile vinceva sempre lui, perche' nell'elenco viene prima -
 * e il risultato era mille ricette raccolte e nella schermata di oggi
 * "Pasta e legumi".
 *
 * Il libro di casa e' il **pavimento**, non il soffitto: esiste perche' senza
 * chiave e senza catalogo la giornata deve comunque proporre qualcosa. Quando
 * una ricetta vera calza uguale, la ricetta vera e' meglio - ha la foto, il
 * procedimento di qualcuno che l'ha cucinata, e una fonte da citare.
 *
 * Non compra pero' un posto migliore: prima viene quanto calza, poi il
 * punteggio, e solo in fondo questo. Una ricetta con la foto che lascia fuori
 * un componente resta dietro a una di casa che non ne lascia fuori nessuno.
 */
function concretezza(ricetta: RicettaComponibile): number {
  return (ricetta.immagineUrl ? 2 : 0) + (ricetta.fonte ? 1 : 0)
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
    immagineUrl: scelto.ricetta.immagineUrl ?? null,
    fonte: scelto.ricetta.fonte ?? null,
    alternative: elenco
      .filter((a) => a.ricetta.id !== scelto.ricetta.id)
      .slice(0, 6)
      .map((a) => ({
        id: a.ricetta.id,
        titolo: a.ricetta.titolo,
        livello: a.livello,
        immagineUrl: a.ricetta.immagineUrl ?? null,
      })),
  }
}

export type RicettaDelPasto = ReturnType<typeof vestila>

/**
 * I passi di una ricetta del catalogo arrivano solo adesso, per quella scelta.
 *
 * `catalogoComponibile` li lascia vuoti apposta: qui si legge la riga giusta
 * e basta. Se la ricetta viene dal libro scritto a mano non c'e' niente da
 * leggere, i passi li ha gia'.
 */
async function conIPassi(vestita: RicettaDelPasto | null): Promise<RicettaDelPasto | null> {
  if (!vestita || !vestita.id.startsWith(DAL_CATALOGO)) return vestita

  return { ...vestita, passi: await passiDalCatalogo(vestita.id) }
}

function scegli(
  fascia: string,
  componenti: ComponenteAbbinabile[],
  scelta: string | null | undefined,
  catalogo: RicettaComponibile[],
) {
  const elenco = proposte(fascia, componenti, catalogo)

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
  const [arricchiti, catalogo] = await Promise.all([
    arricchisci(componenti),
    catalogoComponibile(),
  ])

  return conIPassi(scegli(fascia, arricchiti, scelta, catalogo))
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

  const [dati, catalogo] = await Promise.all([leggiAlimenti(ids), catalogoComponibile()])
  const per = new Map<number, RicettaDelPasto>()

  for (const pasto of pasti) {
    const ricetta = scegli(
      pasto.fascia,
      unisci(pasto.previsti, dati),
      pasto.ricettaLibro,
      catalogo,
    )

    // Nella scheda del giorno i passi non si mostrano: si mostra la foto e il
    // titolo, e il procedimento sta dietro al tocco. Quindi qui non si legge.
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
  const [arricchiti, catalogo] = await Promise.all([
    arricchisci(componenti),
    catalogoComponibile(),
  ])
  const elenco = proposte(fascia, arricchiti, catalogo)

  if (elenco.length < 2) return null

  const indice = attuale ? elenco.findIndex((a) => a.ricetta.id === attuale) : 0

  return elenco[(Math.max(indice, 0) + 1) % elenco.length]!.ricetta.id
}
