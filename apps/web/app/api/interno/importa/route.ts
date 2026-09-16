import { NextResponse } from 'next/server'

import { importaDaUrl } from '@/lib/ricette/importa'

export const dynamic = 'force-dynamic'

/**
 * Sonda interna usata dal worker per riempire il catalogo.
 *
 * Non e' pensata per il pubblico: il worker la chiama dalla rete privata di
 * Railway e si presenta con un segreto condiviso. Senza quel segreto in
 * ambiente la rotta resta chiusa, cosi' un deploy mal configurato non la
 * espone per sbaglio.
 */
export async function POST(richiesta: Request) {
  const atteso = process.env.SEGRETO_INTERNO

  if (!atteso) {
    return NextResponse.json({ ok: false, motivo: 'rotta non configurata' }, { status: 503 })
  }

  if (richiesta.headers.get('x-segreto-interno') !== atteso) {
    return NextResponse.json({ ok: false, motivo: 'non autorizzato' }, { status: 401 })
  }

  let corpo: { url?: unknown }

  try {
    corpo = await richiesta.json()
  } catch {
    return NextResponse.json({ ok: false, motivo: 'corpo non leggibile' }, { status: 400 })
  }

  if (typeof corpo.url !== 'string') {
    return NextResponse.json({ ok: false, motivo: 'manca url' }, { status: 400 })
  }

  const esito = await importaDaUrl(corpo.url)

  return NextResponse.json(esito, { status: esito.ok ? 200 : 422 })
}
