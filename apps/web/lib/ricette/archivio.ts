import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import { alimenti, db, ricettaIngredienti, ricette } from '@prontooo/db'

import { RUOLI_IN_CATALOGO, classifica } from './fasce'
import { chiaveConfigurata, leggiIngredienti } from './normalizza'
import { type IngredienteRiconosciuto, converti } from './posti'
import { nutrientiDi, sommaNutrienti } from '../lista/modello'

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
  /**
   * Le ricette che non sono entrate nel piano, col conto delle righe non
   * capite.
   *
   * L'elenco delle righe sconosciute dice **cosa** manca ma non **come** e'
   * distribuito, e la differenza cambia il lavoro da fare. Venti ricette con
   * una riga difficile ciascuna sono venti ricette da riscattare allargando il
   * vocabolario; una ricetta con sei righe difficili su sei e' una ricetta che
   * non doveva stare in catalogo - o un guasto nella lettura.
   *
   * Col titolo accanto si vede anche la terza cosa: se fra le bloccate
   * compaiono dei dolci, allora il problema non e' il vocabolario ma la
   * classificazione che li ha fatti passare per secondi.
   */
  bloccate: { titolo: string; nonCapite: number; righe: number }[]
}

/** Quante ricette bloccate riportare: serve il campione, non l'elenco. */
const BLOCCATE_DA_RIPORTARE = 10

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

/**
 * Il catalogo in quattro numeri, per il log di ogni giro.
 *
 * Serve a rispondere alla domanda che si fa davvero - "a che punto siamo, e
 * quanto costa arrivare in fondo" - senza andare a contare a mano sul
 * database. Una query sola, nessun modello: sta accanto al conteggio che il
 * giro fa gia' per sapere quando smettere.
 *
 * I quattro numeri non sono intercambiabili, ed e' il motivo per cui ci sono
 * tutti e quattro: `raccolte` e' quanto abbiamo preso dai siti, `daPiano` e'
 * quanto di quello potrebbe reggere un pranzo o una cena, `lette` e' quanto
 * abbiamo pagato per leggere, e `nelPiano` e' l'unico che conta davvero -
 * quante ricette hanno i posti e finiscono nella schermata di oggi.
 */
export async function statoCatalogo(): Promise<{
  raccolte: number
  daPiano: number
  lette: number
  nelPiano: number
}> {
  const [riga] = await db()
    .select({
      raccolte: sql<number>`count(*)::int`,
      daPiano: sql<number>`(count(*) filter (where ${inArray(ricette.ruolo, RUOLI_IN_CATALOGO)}))::int`,
      lette: sql<number>`(count(*) filter (where ${isNotNull(ricette.normalizzataIl)}))::int`,
      nelPiano: sql<number>`(count(*) filter (where jsonb_array_length(${ricette.posti}) > 0))::int`,
    })
    .from(ricette)

  return riga ?? { raccolte: 0, daPiano: 0, lette: 0, nelPiano: 0 }
}

/**
 * I nutrienti di una ricetta, sommati dai suoi ingredienti riconosciuti.
 *
 * Tornano nulli quando non c'e' niente da sommare - nessun ingrediente
 * riconosciuto, o nessuno con dei valori. Nullo e' diverso da zero: zero
 * vorrebbe dire "questa ricetta non nutre", e non e' quello che sappiamo.
 */
function nutrientiDellaRicetta(
  righe: { alimento: { kcal: string | null } | null; grammi: number | null }[],
) {
  const conValori = righe.filter((r) => r.alimento !== null && (r.grammi ?? 0) > 0)

  if (conValori.length === 0) return null

  const somma = sommaNutrienti(
    conValori.map((r) => nutrientiDi(r.alimento as never, r.grammi ?? 0)),
  )

  if (somma.kcal <= 0) return null

  return {
    kcal: String(Math.round(somma.kcal)),
    proteine: String(Math.round(somma.proteine * 10) / 10),
    carboidrati: String(Math.round(somma.carboidrati * 10) / 10),
    grassi: String(Math.round(somma.grassi * 10) / 10),
  }
}

/**
 * Rifa' i posti di quello che e' gia' stato letto, **senza chiamare il modello**.
 *
 * Si puo' fare per un motivo solo, ed e' una fortuna: la normalizzazione non
 * salva soltanto i posti, salva anche l'alimento riga per riga su
 * `ricetta_ingredienti`. Quel lavoro - l'unico che si paga - e' gia' in
 * archivio. Rifare i posti da li' e' aritmetica.
 *
 * Serve adesso perche' un posto ha imparato a ricordarsi con quale alimento e'
 * nato, e senza quel ricordo "Baccala' alle verdure" arrivava in tavola coi
 * calamari: il posto chiedeva gruppo `pesce`, e il gruppo pesce lo riempiono
 * anche i calamari e i gamberi.
 *
 * Tocca solo le ricette che **hanno** dei posti. Quelle con i posti vuoti o non
 * sono state lette o avevano una riga non capita: in tutti e due i casi
 * ricostruirle non cambierebbe niente, e su quelle una riga senza alimento non
 * si sa se era libera o sconosciuta. Qui invece si sa: se la ricetta ha dei
 * posti vuol dire che era affidabile, e allora ogni riga senza alimento era
 * una riga libera.
 */
export async function ricostruisciPosti(): Promise<number> {
  const connessione = db()

  const daRifare = await connessione
    .select({ id: ricette.id, titolo: ricette.titolo })
    .from(ricette)
    .where(and(isNotNull(ricette.normalizzataIl), sql`jsonb_array_length(${ricette.posti}) > 0`))

  if (daRifare.length === 0) return 0

  const righe = await connessione
    .select({
      ricettaId: ricettaIngredienti.ricettaId,
      rigaGrezza: ricettaIngredienti.rigaGrezza,
      grammi: ricettaIngredienti.grammi,
      alimento: alimenti,
    })
    .from(ricettaIngredienti)
    .leftJoin(alimenti, eq(alimenti.id, ricettaIngredienti.alimentoId))
    .where(
      inArray(
        ricettaIngredienti.ricettaId,
        daRifare.map((r) => r.id),
      ),
    )
    .orderBy(asc(ricettaIngredienti.ricettaId), asc(ricettaIngredienti.posizione))

  const perRicetta = new Map<number, IngredienteRiconosciuto[]>()
  const crudo = new Map<number, { alimento: typeof righe[number]['alimento']; grammi: number | null }[]>()

  for (const riga of righe) {
    const elenco = perRicetta.get(riga.ricettaId) ?? []

    elenco.push(
      riga.alimento === null
        ? // Nessun alimento su una ricetta che ha i posti: era una riga
          // libera. Se fosse stata sconosciuta i posti non ci sarebbero.
          { alimentoId: null, nome: riga.rigaGrezza, gruppo: null, ruolo: null, grammi: null, etichette: [], tipo: 'libero' }
        : {
            alimentoId: riga.alimento.id,
            nome: riga.alimento.nome,
            gruppo: riga.alimento.gruppo,
            ruolo: riga.alimento.ruoli?.[0] ?? null,
            grammi: riga.grammi === null ? null : Number(riga.grammi),
            etichette: riga.alimento.etichette ?? [],
            tipo: 'alimento',
          },
    )

    perRicetta.set(riga.ricettaId, elenco)
    crudo.set(riga.ricettaId, [
      ...(crudo.get(riga.ricettaId) ?? []),
      { alimento: riga.alimento, grammi: riga.grammi === null ? null : Number(riga.grammi) },
    ])
  }

  let rifatte = 0

  for (const ricetta of daRifare) {
    const letti = perRicetta.get(ricetta.id)

    if (!letti || letti.length === 0) continue

    const esito = converti(letti, ricetta.titolo)

    await connessione
      .update(ricette)
      .set({
        posti: esito.affidabile ? esito.posti : [],
        etichette: esito.etichette,
        ...(nutrientiDellaRicetta(crudo.get(ricetta.id) ?? []) ?? {}),
      })
      .where(eq(ricette.id, ricetta.id))

    rifatte += 1
  }

  return rifatte
}

/** Quante ne restano da leggere: serve al worker per sapere quando smettere. */
export async function daNormalizzare(): Promise<number> {
  const [riga] = await db()
    .select({ quante: sql<number>`count(*)::int` })
    .from(ricette)
    .where(DA_LEGGERE)

  return riga?.quante ?? 0
}

/**
 * Il vocabolario, riga intera.
 *
 * Il modello ha bisogno solo di nome e gruppo, ma subito dopo servono anche i
 * valori nutrizionali: una ricetta appena letta si somma e i suoi quattro
 * numeri si salvano sulla riga. Due query per la stessa tabella nello stesso
 * giro sarebbero state una in piu'.
 */
async function vocabolario() {
  return db().select().from(alimenti).orderBy(asc(alimenti.nome))
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
    return { normalizzate: 0, convertite: 0, fallite: 0, restanti: 0, sconosciute: [], bloccate: [] }
  }

  const vocaboli = await vocabolario()
  const sconosciute = new Map<string, { riga: string; quante: number }>()
  const bloccate: { titolo: string; nonCapite: number; righe: number }[] = []
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

    const esito = converti(letti, ricetta.titolo)

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

    // I quattro numeri della ricetta si calcolano adesso, che gli alimenti
    // sono gia' in mano: rifarlo dopo vorrebbe dire rileggere le sue righe.
    const perId = new Map(vocaboli.map((v) => [v.id, v]))

    await connessione
      .update(ricette)
      .set({
        // I posti valgono solo se ho capito **tutte** le righe. Se una resta
        // sconosciuta non posso garantire le etichette, e una ricetta di cui
        // non garantisco le etichette non entra nel piano: resta sfogliabile.
        posti: esito.affidabile ? esito.posti : [],
        etichette: esito.etichette,
        ...(nutrientiDellaRicetta(
          letti.map((l) => ({
            alimento: l.alimentoId === null ? null : (perId.get(l.alimentoId) ?? null),
            grammi: l.grammi,
          })),
        ) ?? {}),
        normalizzataIl: new Date(),
      })
      .where(eq(ricette.id, ricetta.id))

    normalizzate += 1

    if (esito.affidabile && esito.posti.length > 0) {
      convertite += 1
    } else {
      bloccate.push({
        titolo: ricetta.titolo,
        nonCapite: letti.filter((l) => l.tipo === 'sconosciuto').length,
        righe: letti.length,
      })
    }
  }

  return {
    normalizzate,
    convertite,
    fallite,
    restanti: await daNormalizzare(),
    sconosciute: [...sconosciute.values()]
      .sort((a, b) => b.quante - a.quante)
      .slice(0, SCONOSCIUTE_DA_RIPORTARE),
    // Le piu' compromesse per prime: e' li' che si vede se il guasto e' la
    // lettura o se sono ricette che in catalogo non dovevano entrare.
    bloccate: bloccate
      .sort((a, b) => b.nonCapite - a.nonCapite)
      .slice(0, BLOCCATE_DA_RIPORTARE),
  }
}
