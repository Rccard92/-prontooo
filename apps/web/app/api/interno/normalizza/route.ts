import { NextResponse } from 'next/server'

import {
  daNormalizzare,
  normalizzaProssime,
  riclassifica,
  ricostruisciPosti,
  rimettiInCoda,
  statoCatalogo,
} from '@/lib/ricette/archivio'
import { chiaveConfigurata } from '@/lib/ricette/normalizza'

export const dynamic = 'force-dynamic'

/** Un blocco alla volta: il worker torna ogni mezz'ora e non ha fretta. */
const PREDEFINITE = 20

/**
 * Il worker bussa, il web legge.
 *
 * La stessa divisione delle ricette e dei volantini: il worker e' l'unica cosa
 * che gira sempre e quindi fa da sveglia, ma il modello lo chiama il web,
 * perche' il vocabolario e il parser stanno qui e devono restare uno solo.
 *
 * Senza `ANTHROPIC_API_KEY` risponde 503 e dice perche'. Non e' un guasto: e'
 * il catalogo che resta sfogliabile come prima, ed e' il messaggio che il
 * worker si trova nei log invece di un silenzio.
 */
export async function POST(richiesta: Request) {
  const atteso = process.env.SEGRETO_INTERNO

  if (!atteso) {
    return NextResponse.json({ ok: false, motivo: 'rotta non configurata' }, { status: 503 })
  }

  if (richiesta.headers.get('x-segreto-interno') !== atteso) {
    return NextResponse.json({ ok: false, motivo: 'non autorizzato' }, { status: 401 })
  }

  let quante = PREDEFINITE
  let rileggi = false
  let soloStato = false
  let soloRiclassifica = false
  let ricostruisci = false

  try {
    const corpo = (await richiesta.json()) as {
      quante?: unknown
      rileggi?: unknown
      stato?: unknown
      riclassifica?: unknown
      ricostruisci?: unknown
    }

    if (typeof corpo.quante === 'number' && Number.isFinite(corpo.quante)) {
      quante = corpo.quante
    }

    rileggi = corpo.rileggi === true
    soloStato = corpo.stato === true
    soloRiclassifica = corpo.riclassifica === true
    ricostruisci = corpo.ricostruisci === true
  } catch {
    // Corpo vuoto o illeggibile: va bene lo stesso, si usa il predefinito.
  }

  // Solo i conteggi, nessuna lettura. Serve quando la lettura e' in pausa: il
  // freno ferma la spesa, non deve fermare anche il modo di sapere a che punto
  // siamo - e' una query, non costa niente.
  if (soloStato) {
    return NextResponse.json({ ok: true, catalogo: await statoCatalogo() })
  }

  // Rifa' i posti di quello che e' gia' stato letto. Non chiama il modello: le
  // righe con dentro l'alimento sono gia' in archivio, e da li' i posti si
  // ricalcolano. E' il modo di correggere una regola sbagliata senza ricomprare
  // duemila letture.
  if (ricostruisci) {
    return NextResponse.json({ ok: true, ricostruite: await ricostruisciPosti() })
  }

  // Solo la riclassificazione, senza rimettere in coda.
  //
  // Le due cose stavano insieme e non potevano: riclassificare non costa
  // niente e **fa risparmiare**, perche' un dolce che torna a essere un dolce
  // esce dalla coda e non lo si legge piu'. Rimettere in coda invece si paga.
  // Attaccate, per avere la prima bisognava comprare la seconda.
  if (soloRiclassifica) {
    return NextResponse.json({ ok: true, riclassificate: await riclassifica() })
  }

  // Attrezzo da officina: dopo che il vocabolario si allarga, rimette in coda
  // le ricette che si erano fermate su una parola che adesso conosciamo.
  if (rileggi) {
    // Prima si riclassifica, poi si rimette in coda: una ricetta che passa da
    // "non classificabile" a "secondo" deve poter entrare nella coda dello
    // stesso giro, altrimenti resta fuori fino al prossimo attrezzo.
    const riclassificate = await riclassifica()
    const rimesse = await rimettiInCoda()

    return NextResponse.json({ ok: true, riclassificate, rimesseInCoda: rimesse })
  }

  // Qui e non piu' in alto: la chiave serve a leggere le ricette, non a
  // contarle ne' a rimetterle in coda. Tenendo il controllo in cima, un giorno
  // senza chiave avrebbe spento anche il modo di sapere a che punto siamo.
  if (!chiaveConfigurata()) {
    return NextResponse.json(
      { ok: false, motivo: 'ANTHROPIC_API_KEY non configurata', restanti: await daNormalizzare() },
      { status: 503 },
    )
  }

  try {
    return NextResponse.json({ ok: true, ...(await normalizzaProssime(quante)) })
  } catch (errore) {
    console.error('normalizzazione del catalogo fallita:', errore)

    return NextResponse.json(
      { ok: false, motivo: errore instanceof Error ? errore.message : 'errore sconosciuto' },
      { status: 500 },
    )
  }
}
