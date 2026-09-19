import { and, asc, eq, inArray } from 'drizzle-orm'

import {
  type Alimento,
  alimenti,
  db,
  giornataPasti,
  giornate,
} from '@prontooo/db'

import { diStagione, meseCorrente } from '@prontooo/db/alimenti'

import { type VoceConAlimento, vociDi, listaAttiva, righePerFascia } from '../lista/archivio'
import { pesiDiScelta, scegliPesato } from '../nutrizione/preferenze'
import { arrotonda, nutrientiDi, obiettivoDa, sommaNutrienti } from '../lista/modello'
import { FASCE } from '../ricette/fasce'

import { MOLTIPLICATORI, type Componente, type TipoGiorno, nutrientiConsumati } from './modello'
import { ricalibra, type PastoDaRicalibrare } from './ricalibra'

export function oggi(): string {
  const romana = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }))

  return `${romana.getFullYear()}-${String(romana.getMonth() + 1).padStart(2, '0')}-${String(romana.getDate()).padStart(2, '0')}`
}

export type Scoperta = { fascia: string; ruolo: string }

/**
 * Le righe che questo mese restano senza niente da mettere dentro.
 *
 * Succede quando in una riga hai spuntato solo roba fuori stagione: a gennaio
 * una riga di sola frutta estiva resta vuota. Non e' un errore, e'
 * un'informazione da darti - cosi' vai a spuntare due cose d'inverno invece
 * di trovarti la colazione senza frutta e non capire perche'.
 */
export function scoperteDelMese(voci: VoceConAlimento[], mese: number): Scoperta[] {
  const scoperte: Scoperta[] = []

  for (const fascia of FASCE) {
    for (const riga of righePerFascia(voci, fascia)) {
      const restano = riga.voci.some((v) => diStagione(v.alimento?.mesiStagione ?? [], mese))

      if (!restano && riga.voci[0]) {
        scoperte.push({ fascia, ruolo: ruoloDi(riga.voci[0].alimento) })
      }
    }
  }

  return scoperte
}

/** Il ruolo di un alimento dentro il pasto: il primo che copre. */
function ruoloDi(alimento: Alimento | null): string {
  return alimento?.ruoli[0] ?? 'base'
}

/**
 * Compone i pasti di un giorno dalla lista di ingredienti.
 *
 * Da ogni riga sceglie **una** alternativa: sono equivalenti per costruzione,
 * le ha messe insieme il nutrizionista o tu. Il caso e' quello che rende utile
 * il pulsante "cambia", ma non e' un caso cieco - e' inclinato verso quello
 * che mangi davvero e quello che e' in offerta. La scelta resta dentro la
 * lista: i pesi cambiano la frequenza, mai l'insieme.
 */
export async function componiGiorno(utenteId: number, tipoGiorno: TipoGiorno) {
  const lista = await listaAttiva(utenteId)

  if (!lista) return null

  const [voci, pesi] = await Promise.all([vociDi(utenteId, lista.id), pesiDiScelta(utenteId)])
  const moltiplicatori = MOLTIPLICATORI[tipoGiorno]
  const mese = meseCorrente()

  const scoperte = scoperteDelMese(voci, mese)

  /** Le righe di una fascia, tolto quello che questo mese non si trova. */
  const righeDiStagione = (fascia: string) =>
    righePerFascia(voci, fascia)
      .map((riga) => ({
        ...riga,
        voci: riga.voci.filter((v) => diStagione(v.alimento?.mesiStagione ?? [], mese)),
      }))

  const pasti = FASCE.map((fascia) => {
    const righe = righeDiStagione(fascia)

    const componenti: Componente[] = righe
      .map((riga) => {
        const scelta = scegliPesato(riga.voci, pesi)

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
        const base = obiettivoDa(righeDiStagione(fascia))
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

  return { listaId: lista.id, pasti, obiettivo, scoperte }
}

/**
 * Cosa resta scoperto questo mese, per la lista attiva di un utente.
 *
 * La pagina di oggi la chiama per dirtelo: non ricompone la giornata, legge
 * la lista e guarda il calendario.
 */
export async function scopertePerUtente(utenteId: number): Promise<Scoperta[]> {
  const lista = await listaAttiva(utenteId)

  if (!lista) return []

  return scoperteDelMese(await vociDi(utenteId, lista.id), meseCorrente())
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
export async function generaGiornata(
  utenteId: number,
  data = oggi(),
  tipoGiorno?: TipoGiorno,
) {
  const connessione = db()

  const [esistente] = await connessione
    .select()
    .from(giornate)
    .where(and(eq(giornate.utenteId, utenteId), eq(giornate.data, data)))
    .limit(1)

  const tipo = tipoGiorno ?? ((esistente?.tipoGiorno as TipoGiorno) || 'standard')
  const composto = await componiGiorno(utenteId, tipo)

  if (!composto) return null

  const [giornata] = await connessione
    .insert(giornate)
    .values({
      utenteId,
      data,
      tipoGiorno: tipo,
      listaId: composto.listaId,
      obiettivo: composto.obiettivo,
    })
    .onConflictDoUpdate({
      target: [giornate.utenteId, giornate.data],
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
      })
      .onConflictDoUpdate({
        target: [giornataPasti.giornataId, giornataPasti.fascia],
        set: {
          previsti: pasto.componenti,
          // I componenti sono cambiati: la ricetta scelta prima non vale piu'.
          ricettaLibro: null,
        },
      })
  }

  return giornata.id
}

/** La giornata con dentro i pasti, pronta da mostrare. */
export async function leggiGiornata(utenteId: number, data = oggi()) {
  const [giornata] = await db()
    .select()
    .from(giornate)
    .where(and(eq(giornate.utenteId, utenteId), eq(giornate.data, data)))
    .limit(1)

  if (!giornata) return null

  const pasti = await db()
    .select({
      id: giornataPasti.id,
      fascia: giornataPasti.fascia,
      stato: giornataPasti.stato,
      bloccato: giornataPasti.bloccato,
      previsti: giornataPasti.previsti,
      consumati: giornataPasti.consumati,
      ricettaLibro: giornataPasti.ricettaLibro,
    })
    .from(giornataPasti)
    .where(eq(giornataPasti.giornataId, giornata.id))
    .orderBy(asc(giornataPasti.id))

  const ordine = FASCE as readonly string[]
  const ordinati = [...pasti].sort((a, b) => ordine.indexOf(a.fascia) - ordine.indexOf(b.fascia))

  const consumato = nutrientiConsumati(ordinati.flatMap((p) => p.consumati))

  return { giornata, pasti: ordinati, consumato }
}

export { ricalibra, type PastoDaRicalibrare }
