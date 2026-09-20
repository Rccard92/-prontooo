import { NextResponse } from 'next/server'

import {
  daNormalizzare,
  normalizzaProssime,
  riclassifica,
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

  if (!chiaveConfigurata()) {
    return NextResponse.json(
      { ok: false, motivo: 'ANTHROPIC_API_KEY non configurata', restanti: await daNormalizzare() },
      { status: 503 },
    )
  }

  let quante = PREDEFINITE
  let rileggi = false

  try {
    const corpo = (await richiesta.json()) as { quante?: unknown; rileggi?: unknown }

    if (typeof corpo.quante === 'number' && Number.isFinite(corpo.quante)) {
      quante = corpo.quante
    }

    rileggi = corpo.rileggi === true
  } catch {
    // Corpo vuoto o illeggibile: va bene lo stesso, si usa il predefinito.
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

  try {
    const esito = await normalizzaProssime(quante)

    // Il catalogo accanto all'esito del blocco: e' una query di conteggio in
    // coda a una chiamata che ne fa gia' una, e risparmia di andare a contare
    // a mano sul database per sapere a che punto siamo.
    return NextResponse.json({ ok: true, ...esito, catalogo: await statoCatalogo() })
  } catch (errore) {
    console.error('normalizzazione del catalogo fallita:', errore)

    return NextResponse.json(
      { ok: false, motivo: errore instanceof Error ? errore.message : 'errore sconosciuto' },
      { status: 500 },
    )
  }
}
