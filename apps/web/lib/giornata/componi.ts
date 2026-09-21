import { and, asc, eq, inArray } from 'drizzle-orm'

import {
  type Alimento,
  alimenti,
  db,
  giornataPasti,
  giornate,
} from '@prontooo/db'

import { SENZA_LATTOSIO, cheFarneCol, diStagione, meseCorrente } from '@prontooo/db/alimenti'

import { type VoceConAlimento, vociDi, listaAttiva, righePerFascia } from '../lista/archivio'
import { leggiProfilo } from '../profilo/leggi'
import { ammessi } from '../nutrizione/esclusioni'
import {
  PASTI_CON_GLUTINE,
  attive,
  preferiSenza,
  senzaLeEscluse,
} from '../nutrizione/attenuazioni'
import { type DatiCorpo, datiCompleti, fabbisognoDi, kcalPerFascia } from '../nutrizione/fabbisogno'
import { pesiDiScelta, scegliPesato } from '../nutrizione/preferenze'
import { arrotonda, nutrientiDi, sommaNutrienti } from '../lista/modello'
import { FASCE } from '../ricette/fasce'

import { MOLTIPLICATORI, type Componente, type TipoGiorno, nutrientiConsumati } from './modello'
import { pastiDalleRicette, scalaRicetta } from './daRicetta'
import { postiDi, riempiPosti } from './schema'
import { ricalibra, scalaComponenti, type PastoDaRicalibrare } from './ricalibra'

export function oggi(): string {
  const romana = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }))

  return `${romana.getFullYear()}-${String(romana.getMonth() + 1).padStart(2, '0')}-${String(romana.getDate()).padStart(2, '0')}`
}

export type Scoperta = { fascia: string; posto: string }

/** Il ruolo di un alimento dentro il pasto: il primo che copre. */
function ruoloDi(alimento: Alimento | null): string {
  return alimento?.ruoli[0] ?? 'base'
}

/** Le righe di una fascia con il loro ruolo, prima e dopo il filtro stagione. */
function righeConRuolo(voci: VoceConAlimento[], fascia: string, mese: number) {
  return righePerFascia(voci, fascia).map((riga) => ({
    ruolo: ruoloDi(riga.voci[0]?.alimento ?? null),
    voci: riga.voci.filter((v) => diStagione(v.alimento?.mesiStagione ?? [], mese)),
    quante: riga.voci.length,
  }))
}

/**
 * I posti che questo mese restano vuoti pur avendo qualcosa di spuntato.
 *
 * Succede quando per un posto hai spuntato solo roba fuori stagione: a gennaio
 * una colazione di sola frutta estiva resta senza frutta. Non e' un errore,
 * e' un'informazione da darti - cosi' vai a spuntare due cose d'inverno
 * invece di trovarti il piatto corto e non capire perche'.
 *
 * Un posto che non hai proprio riempito - niente verdura spuntata, mai - non
 * e' una scoperta del mese: quello e' un buco della lista, e lo dice la
 * schermata degli ingredienti, non il calendario.
 */
export function scoperteDelMese(voci: VoceConAlimento[], mese: number): Scoperta[] {
  const scoperte: Scoperta[] = []

  for (const fascia of FASCE) {
    const righe = righeConRuolo(voci, fascia, mese)

    for (const posto of postiDi(fascia)) {
      if (!posto.obbligatorio) continue

      const sue = righe.filter((r) => posto.ruoli.includes(r.ruolo))
      const spuntate = sue.reduce((t, r) => t + r.quante, 0)
      const restano = sue.reduce((t, r) => t + r.voci.length, 0)

      if (spuntate > 0 && restano === 0) scoperte.push({ fascia, posto: posto.nome })
    }
  }

  return scoperte
}

/** I nomi della lista che al banco hanno un gemello senza lattosio. */
function componibili(voci: VoceConAlimento[]): string[] {
  return [
    ...new Set(
      voci
        .map((v) => v.alimento?.nome)
        .filter((n): n is string => n !== undefined && SENZA_LATTOSIO[n] !== undefined)
        .map((n) => SENZA_LATTOSIO[n]!),
    ),
  ]
}

/**
 * I gemelli delattosati, letti dal vocabolario in una query sola.
 *
 * Dal vocabolario e non dalla lista: la mozzarella senza lattosio puo' non
 * essere fra le cose che hai spuntato - anzi, di solito non lo e', perche'
 * hai spuntato la mozzarella e basta.
 */
async function leggiGemelli(nomi: string[]): Promise<Map<string, Alimento>> {
  if (nomi.length === 0) return new Map()

  const righe = await db().select().from(alimenti).where(inArray(alimenti.nome, nomi))
  const per = new Map<string, Alimento>()

  for (const [normale, gemello] of Object.entries(SENZA_LATTOSIO)) {
    const trovato = righe.find((r) => r.nome === gemello)

    if (trovato) per.set(normale, trovato)
  }

  return per
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

  const [voci, pesi, impostazioni] = await Promise.all([
    vociDi(utenteId, lista.id),
    pesiDiScelta(utenteId),
    leggiProfilo(utenteId),
  ])
  const moltiplicatori = MOLTIPLICATORI[tipoGiorno]
  const mese = meseCorrente()

  const esclusioni = impostazioni?.esclusioni ?? []

  // Le esclusioni si applicano **prima** di tutto il resto e su tutta la
  // lista: sono rigide, e devono valere anche su una lista vecchia, importata
  // da un PDF o spuntata prima di metterle. E' questa la rete di sicurezza.
  const ammesse = ammessi(voci, esclusioni, (v) => v.alimento?.etichette)
  const scoperte = scoperteDelMese(ammesse, mese)

  // Le attenuazioni sono la via di mezzo, e stanno **dopo** le esclusioni:
  // su un'etichetta che hai gia' escluso non c'e' piu' niente da attenuare.
  const attenuazioni = senzaLeEscluse(impostazioni?.attenuazioni ?? [], esclusioni)
  const riduceGlutine = attive(attenuazioni, 'riduci').includes('glutine')
  const sostituisceLattosio = attive(attenuazioni, 'sostituisci').includes('lattosio')

  /** Il gemello delattosato, quando serve e quando esiste. */
  const gemelli = sostituisceLattosio ? await leggiGemelli(componibili(ammesse)) : new Map()

  // Chi attenua il lattosio non perde il latticino: perde solo quelli per cui
  // al banco non c'e' alternativa. Gli stagionati restano dove sono.
  const conLattosioARegola = sostituisceLattosio
    ? ammesse.filter(
        (v) =>
          v.alimento === null ||
          cheFarneCol(v.alimento.nome, v.alimento.etichette) !== 'togli',
      )
    : ammesse

  let pastiColGlutine = 0

  const pasti = FASCE.map((fascia) => {
    const righe = righeConRuolo(conLattosioARegola, fascia, mese)

    // Una sola fonte di glutine per pasto, e non a tutti i pasti: e' questo
    // che vuol dire ridurre. Se pero' togliendola la riga resta vuota, il
    // glutine passa lo stesso - meglio il pane per la terza volta che un
    // pranzo senza base. Lo zero assoluto si chiede con l'esclusione.
    let glutineQui = false

    const pesca = (voci: VoceConAlimento[]) => {
      const quota = glutineQui || pastiColGlutine >= PASTI_CON_GLUTINE
      const mucchio =
        riduceGlutine && quota
          ? preferiSenza(voci, (v) => v.alimento?.etichette.includes('glutine') ?? false)
          : voci

      const scelta = scegliPesato(mucchio, pesi)

      if (scelta?.alimento?.etichette.includes('glutine')) glutineQui = true

      return scelta
    }

    // Lo schema decide **quanti** posti ha il piatto; la lista decide chi puo'
    // starci; i pesi decidono chi ci sta oggi. Prima erano tre cose sole - una
    // per riga spuntata - e veniva fuori un inventario invece di un pasto.
    const componenti: Componente[] = riempiPosti(postiDi(fascia), righe, pesca)
      .map(({ scelta }) => {
        if (!scelta) return null

        const ruolo = ruoloDi(scelta.alimento)
        const base = Number(scelta.quantita)
        const fattore = moltiplicatori[ruolo] ?? 1
        const nome = scelta.alimento?.nome ?? scelta.testoGrezzo ?? 'Da collegare'

        // Qui la mozzarella diventa mozzarella senza lattosio: stesso posto,
        // stessi grammi, il nome che devi cercare al banco.
        const gemello = gemelli.get(nome) ?? null

        return {
          ruolo,
          alimentoId: gemello?.id ?? scelta.alimentoId,
          nome: gemello?.nome ?? nome,
          // Le voci "a piacere" hanno quantita' zero e restano tali.
          quantita: base === 0 ? 0 : Math.max(5, Math.round((base * fattore) / 5) * 5),
          unita: scelta.unita,
        }
      })
      .filter((c): c is Componente => c !== null)

    if (glutineQui) pastiColGlutine += 1

    return { fascia, componenti, ricetta: null as string | null }
  }).filter((p) => p.componenti.length > 0)

  const corpo: Partial<DatiCorpo> = {
    sesso: (impostazioni?.sesso ?? undefined) as DatiCorpo['sesso'] | undefined,
    eta: impostazioni?.eta ?? undefined,
    altezza: impostazioni?.altezza ?? undefined,
    pesoKg: impostazioni?.pesoKg === null ? undefined : Number(impostazioni?.pesoKg),
    attivita: (impostazioni?.attivita ?? undefined) as DatiCorpo['attivita'] | undefined,
    obiettivo: (impostazioni?.obiettivo ?? undefined) as DatiCorpo['obiettivo'] | undefined,
  }

  const fattoreGiorno = tipoGiorno === 'on' ? 1.12 : tipoGiorno === 'off' ? 0.92 : 1

  // Se sappiamo com'e' fatto il tuo corpo, le porzioni smettono di essere
  // quelle generiche del vocabolario e diventano le tue: si compone col
  // riferimento e poi si scala ogni pasto sulle kcal che gli spettano.
  const fabbisogno = datiCompleti(corpo) ? fabbisognoDi(corpo, fattoreGiorno) : null

  const bersagli = fabbisogno
    ? kcalPerFascia(
        fabbisogno.giornaliero,
        pasti.map((p) => p.fascia),
      )
    : null

  if (bersagli) {
    for (const pasto of pasti) {
      const bersaglio = bersagli.get(pasto.fascia)
      const adesso = kcalDiComponenti(pasto.componenti, voci)

      if (!bersaglio || adesso <= 0) continue

      pasto.componenti = scalaComponenti(pasto.componenti, bersaglio / adesso)
    }
  }

  // Dove il catalogo ha una ricetta vera, il pasto diventa **quella ricetta**.
  //
  // Prima di qui i componenti erano i tuoi alimenti, e la ricetta arrivava
  // dopo a fare da vestito: si prendeva la forma del piatto e ci si infilava
  // la tua roba, per cui "Baccala' alle verdure" finiva coi calamari. Adesso
  // il piatto e' quello scritto dalla fonte, e a tornare sui tuoi numeri e'
  // la proporzione: stessi ingredienti, meno grammi.
  //
  // Il bersaglio e' quello del fabbisogno se lo conosciamo; se no, le kcal
  // che quel pasto aveva con le porzioni di riferimento. In tutti e due i
  // casi si scala su un numero che vuol dire qualcosa.
  const conRicetta = await pastiDalleRicette(
    pasti.map((p) => p.fascia),
    esclusioni,
    // Il gemello senza lattosio serve a chi lo attenua **e** a chi lo
    // esclude: una ricetta in cui la mozzarella e' diventata senza lattosio
    // il lattosio non ce l'ha piu', e scartarla sarebbe togliere un piatto
    // che va benissimo.
    sostituisceLattosio || esclusioni.includes('lattosio'),
  )

  const nutrientiDelPasto = new Map<string, ReturnType<typeof sommaNutrienti>>()

  for (const pasto of pasti) {
    const dalla = conRicetta.pasti.get(pasto.fascia)

    if (!dalla) continue

    const bersaglio = bersagli?.get(pasto.fascia) ?? kcalDiComponenti(pasto.componenti, voci)
    const fattore = bersaglio > 0 ? bersaglio / dalla.nutrienti.kcal : 1

    pasto.componenti = scalaRicetta(dalla.componenti, fattore)
    pasto.ricetta = dalla.ricetta

    // Ricontati sui grammi scalati, non stimati dal fattore: lo scalino di
    // cinque grammi e i minimi fanno scarto, e questo numero finisce
    // nell'obiettivo della giornata.
    nutrientiDelPasto.set(
      pasto.fascia,
      sommaNutrienti(
        pasto.componenti.map((c) =>
          nutrientiDi(
            c.alimentoId === null ? null : (conRicetta.alimenti.get(c.alimentoId) ?? null),
            c.quantita,
          ),
        ),
      ),
    )
  }

  const obiettivo = fabbisogno
    ? {
        kcal: fabbisogno.giornaliero,
        proteine: fabbisogno.proteine,
        carboidrati: fabbisogno.carboidrati,
        grassi: fabbisogno.grassi,
      }
    : arrotonda(
        // Senza i dati del corpo l'obiettivo e' quello che il piano ti mette
        // davvero nel piatto. Sommare tutte le righe spuntate - com'era prima
        // - darebbe un bersaglio che nessuna giornata puo' raggiungere: nel
        // pasto ne entrano quattro, non quaranta.
        sommaNutrienti(
          pasti.flatMap((pasto) => {
            // Un pasto che viene da una ricetta li ha gia' contati, e sui suoi
            // alimenti: cercarli nella tua lista non li troverebbe, perche'
            // sono quelli della ricetta.
            const gia = nutrientiDelPasto.get(pasto.fascia)

            if (gia) return [gia]

            return pasto.componenti.map((c) =>
              nutrientiDi(
                c.alimentoId === null
                  ? null
                  : (voci.find((v) => v.alimentoId === c.alimentoId)?.alimento ?? null),
                c.quantita,
              ),
            )
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

/**
 * Le kcal di un pasto appena composto, senza tornare sul database.
 *
 * Gli alimenti stanno gia' dentro le voci della lista: rileggerli sarebbe una
 * query per pasto per ogni generazione.
 */
function kcalDiComponenti(componenti: Componente[], voci: VoceConAlimento[]): number {
  const per = new Map(
    voci.filter((v) => v.alimento !== null).map((v) => [v.alimentoId, v.alimento]),
  )

  return componenti.reduce((totale, c) => {
    const alimento = c.alimentoId === null ? null : (per.get(c.alimentoId) ?? null)

    return totale + nutrientiDi(alimento, c.quantita).kcal
  }, 0)
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
        ricettaLibro: pasto.ricetta,
      })
      .onConflictDoUpdate({
        target: [giornataPasti.giornataId, giornataPasti.fascia],
        set: {
          previsti: pasto.componenti,
          // Quando il pasto **e'** una ricetta, quale ricetta e' parte del
          // pasto e va salvato con lui: i componenti sono i suoi ingredienti,
          // e cercarne un'altra vorrebbe dire rimettere un titolo sbagliato
          // sopra lo stesso piatto. Dove invece i componenti vengono dalla tua
          // lista si riparte da zero, come prima.
          ricettaLibro: pasto.ricetta,
        },
      })
  }

  return giornata.id
}

/** Quel che serve a disegnare una casella del calendario. */
export type GiornoDiSettimana = {
  data: string
  /** C'e' un piano per quel giorno, o la casella e' vuota. */
  esiste: boolean
  tipoGiorno: TipoGiorno
  /** Le kcal della giornata: quelle registrate dove hai mangiato, quelle previste dove no. */
  kcal: number
  kcalObiettivo: number
  registrati: number
  pasti: number
}

/**
 * I sette giorni in una volta sola, per la striscia del calendario.
 *
 * Tre query per tutta la settimana invece di tre per giorno: le giornate, i
 * loro pasti, e gli alimenti citati da tutti. Chiamare `leggiGiornata` sette
 * volte sarebbe stato piu' corto da scrivere e avrebbe fatto ventuno viaggi
 * sul database per disegnare una riga di caselle.
 */
export async function settimana(utenteId: number, date: string[]): Promise<GiornoDiSettimana[]> {
  const vuota = (data: string): GiornoDiSettimana => ({
    data,
    esiste: false,
    tipoGiorno: 'standard',
    kcal: 0,
    kcalObiettivo: 0,
    registrati: 0,
    pasti: 0,
  })

  if (date.length === 0) return []

  const connessione = db()

  const righe = await connessione
    .select()
    .from(giornate)
    .where(and(eq(giornate.utenteId, utenteId), inArray(giornate.data, date)))

  if (righe.length === 0) return date.map(vuota)

  const pasti = await connessione
    .select({
      giornataId: giornataPasti.giornataId,
      stato: giornataPasti.stato,
      previsti: giornataPasti.previsti,
      consumati: giornataPasti.consumati,
    })
    .from(giornataPasti)
    .where(
      inArray(
        giornataPasti.giornataId,
        righe.map((r) => r.id),
      ),
    )

  // Gli alimenti di tutta la settimana in un colpo: i previsti portano i
  // grammi ma non le calorie, che stanno sull'alimento.
  const ids = [
    ...new Set(
      pasti.flatMap((p) => p.previsti.map((c) => c.alimentoId)).filter((id): id is number => id !== null),
    ),
  ]

  const perAlimento = new Map(
    ids.length === 0
      ? []
      : (await connessione.select().from(alimenti).where(inArray(alimenti.id, ids))).map((a) => [a.id, a]),
  )

  const perGiornata = new Map(righe.map((r) => [r.id, r]))
  const conto = new Map<string, GiornoDiSettimana>(date.map((d) => [d, vuota(d)]))

  for (const riga of righe) {
    const giorno = conto.get(riga.data)

    if (!giorno) continue

    giorno.esiste = true
    giorno.tipoGiorno = (riga.tipoGiorno as TipoGiorno) || 'standard'
    giorno.kcalObiettivo = Math.round(riga.obiettivo?.kcal ?? 0)
  }

  for (const pasto of pasti) {
    const riga = perGiornata.get(pasto.giornataId)
    const giorno = riga ? conto.get(riga.data) : undefined

    if (!giorno) continue

    giorno.pasti += 1

    // Dove hai registrato vale quello che hai mangiato, dove no vale il
    // piano. Mettere sempre il previsto direbbe che la giornata e' andata
    // come doveva anche quando non e' andata cosi'.
    if (pasto.stato === 'previsto') {
      giorno.kcal += pasto.previsti.reduce(
        (t, c) => t + nutrientiDi(c.alimentoId === null ? null : (perAlimento.get(c.alimentoId) ?? null), c.quantita).kcal,
        0,
      )
    } else {
      giorno.registrati += 1
      giorno.kcal += pasto.consumati.reduce((t, c) => t + c.kcal, 0)
    }
  }

  return date.map((d) => {
    const giorno = conto.get(d) ?? vuota(d)

    return { ...giorno, kcal: Math.round(giorno.kcal) }
  })
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
