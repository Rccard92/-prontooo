import { NextResponse } from 'next/server'

import { mandaPromemoria } from '@/lib/promemoria/manda'

export const dynamic = 'force-dynamic'

/**
 * La sonda dei promemoria, chiamata dal worker una volta all'ora.
 *
 * L'orario non lo decide chi chiama: lo decide `promemoriaDovuto`, che sa
 * che ora e' a Roma e sa se il promemoria di oggi e' gia' partito. Il worker
 * bussa e basta.
 */
export async function POST(richiesta: Request) {
  const atteso = process.env.SEGRETO_INTERNO

  if (!atteso) {
    return NextResponse.json({ ok: false, motivo: 'rotta non configurata' }, { status: 503 })
  }

  if (richiesta.headers.get('x-segreto-interno') !== atteso) {
    return NextResponse.json({ ok: false, motivo: 'non autorizzato' }, { status: 401 })
  }

  try {
    const esito = await mandaPromemoria()

    return NextResponse.json({ ok: true, ...esito })
  } catch (errore) {
    console.error('invio dei promemoria fallito:', errore)

    return NextResponse.json({ ok: false, motivo: 'invio fallito' }, { status: 500 })
  }
}
