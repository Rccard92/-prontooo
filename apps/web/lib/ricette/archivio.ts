import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import { alimenti, db, ricettaIngredienti, ricette } from '@prontooo/db'

import { RUOLI_IN_CATALOGO, classifica } from './fasce'
import { chiaveConfigurata, leggiIngredienti } from './normalizza'
import { converti } from './posti'

/**
 * Normalizzare il catalogo, una ricetta alla volta.
 *
 * Le 419 ricette raccolte dai siti sono ferme in archivio per un motivo
 * preciso: non sappiamo cosa contengono. Finche' "320 g di pasta di semola" e'
 * una stringa, non c'e' modo di dire se dentro c'e' il glutine, ne' di
 * sostituire quei grammi coi tuoi. Sono ricette da guardare, non da usare.
 *
 * Qui smettono di esserlo. Ogni ricetta si legge **una volta sola** e il
 * risultato si salva: gli ingredienti diventano alimenti del vocabolario, le
 * etichette si sommano, e i ruoli diventano i **posti** che la fanno entrare
 * nel piano con la sua foto e il suo procedimento.
 */

export type EsitoNormalizzazione = {
  normalizzate: number
  convertite: number
  fallite: number
  restanti: number
  /**
   * Le righe che il vocabolario non ha saputo tradurre, le piu' frequenti
   * prima.
   *
   * Sono la cosa piu' utile che questo giro produce, e per un motivo che si e'
   * visto solo provando: del primo centinaio di ricette lette ne sono entrate
   * nel piano tredici. La regola che le ferma e' giusta - una riga non capita
   * toglie la garanzia a tutta la ricetta - ma quasi sempre quella riga e'
   * vino bianco, o scalogno, o pangrattato: roba che al vocabolario manca e
   * basta.
   *
   * Invece di indovinare cosa aggiungere, il giro lo scrive nei log. Si
   * allarga il vocabolario su quello che le ricette chiedono davvero, e le
   * ricette non passate si rimandano in lettura.
   */
  sconosciute: { riga: string; quante: number }[]
}

/** Quante righe sconosciute riportare: le altre sono una coda lunghissima. */
const SCONOSCIUTE_DA_RIPORTARE = 25

/**
 * Le righe grezze ridotte a quello che le accomuna.
 *
 * "200 g di vino bianco secco" e "un bicchiere di vino bianco" sono la stessa
 * mancanza, e contarle separate le terrebbe tutte e due in fondo alla
 * classifica. Si buttano numeri, unita' e parole di quantita', e resta il
 * nome.
 */
const MISURE = [
  'g',
  'gr',
  'grammi',
  'kg',
  'ml',
  'cl',
  'l',
  'litr[oi]',
  'un',
  'uno',
  'una',
  'di',
  'd',
  'del',
  'dell[aeo]',
  'dei',
  'delle',
  'circa',
  'cucchiai[o]?',
  'cucchiain[oi]',
  'bicchier[ei]',
  'tazz[ae]',
  'pizzic(?:o|hi)',
  'spicchi[o]?',
  'fogli[ae]',
  'rametti?',
  'rametto',
  'fett[ae]',
  'mazzett[oi]',
  'confezion[ei]',
  'barattol[oi]',
  'scatol[ae]',
  'vasett[oi]',
  'manciat[ae]',
]

export function nocciolo(riga: string): string {
  return (
    riga
      .toLowerCase()
      // Le parentesi portano note - "(a cubetti)", "(circa 2)" - non alimenti.
      .replace(/\([^)]*\)/g, ' ')
      // "q.b." prima dei numeri: dopo averlo spezzato in "q b" non si
      // riconosce piu', e resterebbe attaccato al nome per sempre.
      .replace(/\bq\.?\s?b\.?/g, ' ')
      .replace(/\bquanto basta\b/g, ' ')
      .replace(/[\d.,/]+/g, ' ')
      .replace(new RegExp(`\\b(?:${MISURE.join('|')})\\b`, 'g'), ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Le ricette che vale la pena leggere: primi, secondi e piatti unici.
 *
 * La stessa regola che tiene il catalogo pulito all'ingresso, applicata anche
 * a quello che c'e' gia' dentro. Serve perche' le due cose non succedono
 * insieme: il filtro all'ingresso vale da adesso, ma in catalogo restano le
 * crostate raccolte prima, e leggerle sarebbe pagare per ricette che il piano
 * non proporra' mai.
 *
 * Non si segnano nemmeno come lette: restano fuori portata e basta. Se un
 * giorno la classificazione migliora e una ricetta cambia ruolo, rientra da
 * sola nella coda senza che nessuno debba ricordarsene.
 */
const DA_LEGGERE = and(
  isNull(ricette.normalizzataIl),
  inArray(ricette.ruolo, RUOLI_IN_CATALOGO),
)

/**
 * Rimette in coda le ricette lette ma non convertite.
 *
 * Serve quando il vocabolario si allarga: una ricetta si era fermata su
 * "pangrattato", adesso il pangrattato c'e', e quella ricetta merita un
 * secondo tentativo. Rileggerla costa quanto la prima volta - due decimi di
 * centesimo - e vale molto di piu'.
 *
 * Tocca solo quelle senza posti: le convertite stanno bene come sono, e
 * rileggerle sarebbe pagare due volte per lo stesso risultato.
 *
 * **Si accende, si usa, si spegne.** Lasciato acceso e' una perdita: le
 * ricette che non passano non passeranno nemmeno al giro dopo - hanno dentro
 * il caviale o l'umeboshi - e rimetterle in coda ogni mezz'ora vuol dire
 * rileggerle ogni mezz'ora, pagando ogni volta lo stesso niente.
 */
/**
 * Riclassifica quello che c'e' gia' in catalogo.
 *
 * Il ruolo si decide all'importazione e resta scritto sulla riga. Quando la
 * tabella delle parole migliora - come quando ha imparato a leggere il titolo
 * - le ricette vecchie non se ne accorgono: restano col ruolo nullo che
 * avevano, e col ruolo nullo non si leggono e non si propongono. Sono ricette
 * gia' raccolte che resterebbero fuori per sempre.
 *
 * Non costa niente: nessun modello, solo la tabella di parole e un giro di
 * UPDATE.
 */
export async function riclassifica(): Promise<number> {
  const connessione = db()

  const tutte = await connessione
    .select({
      id: ricette.id,
      titolo: ricette.titolo,
      categoriaFonte: ricette.categoriaFonte,
      fonteUrl: ricette.fonteUrl,
      ruolo: ricette.ruolo,
    })
    .from(ricette)

  let cambiate = 0

  for (const r of tutte) {
    const { ruolo, fasce } = classifica(r.categoriaFonte, r.fonteUrl, r.titolo)

    if (ruolo === r.ruolo) continue

    await connessione.update(ricette).set({ ruolo, fasce }).where(eq(ricette.id, r.id))
    cambiate += 1
  }

  return cambiate
}

export async function rimettiInCoda(): Promise<number> {
  const rimesse = await db()
    .update(ricette)
    .set({ normalizzataIl: null })
    .where(
      and(
        isNotNull(ricette.normalizzataIl),
        inArray(ricette.ruolo, RUOLI_IN_CATALOGO),
        sql`jsonb_array_length(${ricette.posti}) = 0`,
      ),
    )
    .returning({ id: ricette.id })

  return rimesse.length
}

/** Quante ne restano da leggere: serve al worker per sapere quando smettere. */
export async function daNormalizzare(): Promise<number> {
  const [riga] = await db()
    .select({ quante: sql<number>`count(*)::int` })
    .from(ricette)
    .where(DA_LEGGERE)

  return riga?.quante ?? 0
}

/** Il vocabolario ridotto a quello che serve per tradurre una riga. */
async function vocabolario() {
  return db()
    .select({
      id: alimenti.id,
      nome: alimenti.nome,
      gruppo: alimenti.gruppo,
      ruoli: alimenti.ruoli,
      etichette: alimenti.etichette,
    })
    .from(alimenti)
    .orderBy(asc(alimenti.nome))
}

/**
 * Legge le prossime `quante` ricette non ancora normalizzate.
 *
 * Un blocco alla volta, non tutte insieme: il vocabolario sta nella cache del
 * prompt e resta caldo fra una ricetta e l'altra, e se qualcosa va storto si
 * perde un blocco invece di un giro intero. Le ricette gia' fatte non si
 * ritoccano - `normalizzataIl` e' il segno che il lavoro e' stato fatto.
 */
export async function normalizzaProssime(quante: number): Promise<EsitoNormalizzazione> {
  if (!chiaveConfigurata()) {
    throw new Error('ANTHROPIC_API_KEY non configurata')
  }

  const connessione = db()

  const daFare = await connessione
    .select({ id: ricette.id, titolo: ricette.titolo })
    .from(ricette)
    .where(DA_LEGGERE)
    .orderBy(asc(ricette.id))
    .limit(Math.max(1, Math.min(quante, 50)))

  if (daFare.length === 0) {
    return { normalizzate: 0, convertite: 0, fallite: 0, restanti: 0, sconosciute: [] }
  }

  const vocaboli = await vocabolario()
  const sconosciute = new Map<string, { riga: string; quante: number }>()
  let normalizzate = 0
  let convertite = 0
  let fallite = 0

  for (const ricetta of daFare) {
    const righe = await connessione
      .select({
        id: ricettaIngredienti.id,
        posizione: ricettaIngredienti.posizione,
        rigaGrezza: ricettaIngredienti.rigaGrezza,
      })
      .from(ricettaIngredienti)
      .where(eq(ricettaIngredienti.ricettaId, ricetta.id))
      .orderBy(asc(ricettaIngredienti.posizione))

    // Una ricetta senza ingredienti non si puo' leggere, ma nemmeno si deve
    // riprovare per sempre: si segna fatta e resta in archivio.
    if (righe.length === 0) {
      await connessione
        .update(ricette)
        .set({ normalizzataIl: new Date(), posti: [], etichette: [] })
        .where(eq(ricette.id, ricetta.id))
      normalizzate += 1
      continue
    }

    let letti
    try {
      letti = await leggiIngredienti(
        righe.map((r) => r.rigaGrezza),
        vocaboli,
      )
    } catch (errore) {
      // Si lascia `normalizzataIl` nullo: la ricetta torna nel giro dopo.
      // Meglio riprovarla che segnarla fatta con dentro niente.
      console.error(`normalizzazione fallita per "${ricetta.titolo}":`, errore)
      fallite += 1
      continue
    }

    const esito = converti(letti)

    for (const letto of letti) {
      if (letto.tipo !== 'sconosciuto') continue

      const chiave = nocciolo(letto.nome)

      if (chiave.length === 0) continue

      const gia = sconosciute.get(chiave)

      sconosciute.set(chiave, { riga: gia?.riga ?? letto.nome, quante: (gia?.quante ?? 0) + 1 })
    }

    for (const [i, riga] of righe.entries()) {
      const letto = letti[i]

      if (!letto) continue

      await connessione
        .update(ricettaIngredienti)
        .set({
          alimentoId: letto.alimentoId,
          grammi: letto.grammi === null ? null : String(letto.grammi),
        })
        .where(eq(ricettaIngredienti.id, riga.id))
    }

    await connessione
      .update(ricette)
      .set({
        // I posti valgono solo se ho capito **tutte** le righe. Se una resta
        // sconosciuta non posso garantire le etichette, e una ricetta di cui
        // non garantisco le etichette non entra nel piano: resta sfogliabile.
        posti: esito.affidabile ? esito.posti : [],
        etichette: esito.etichette,
        normalizzataIl: new Date(),
      })
      .where(eq(ricette.id, ricetta.id))

    normalizzate += 1
    if (esito.affidabile && esito.posti.length > 0) convertite += 1
  }

  return {
    normalizzate,
    convertite,
    fallite,
    restanti: await daNormalizzare(),
    sconosciute: [...sconosciute.values()]
      .sort((a, b) => b.quante - a.quante)
      .slice(0, SCONOSCIUTE_DA_RIPORTARE),
  }
}
