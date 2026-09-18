import { NextResponse } from 'next/server'

import { importaVolantino } from '@/lib/offerte/archivio'

export const dynamic = 'force-dynamic'

/** Un volantino grosso e' decine di pagine: il limite sta largo ma c'e'. */
const MASSIMO = 40 * 1024 * 1024

/**
 * Riceve un volantino dal worker e lo mette in catalogo.
 *
 * Il worker scarica il PDF - lui ha la rete - e lo passa qui, perche' il
 * parser dei volantini vive nel web e deve restare uno solo. E' la stessa
 * divisione delle ricette: il worker decide **cosa** raccogliere, il web sa
 * **come** leggerlo.
 */
export async function POST(richiesta: Request) {
  const atteso = process.env.SEGRETO_INTERNO

  if (!atteso) {
    return NextResponse.json({ ok: false, motivo: 'rotta non configurata' }, { status: 503 })
  }

  if (richiesta.headers.get('x-segreto-interno') !== atteso) {
    return NextResponse.json({ ok: false, motivo: 'non autorizzato' }, { status: 401 })
  }

  let modulo: FormData

  try {
    modulo = await richiesta.formData()
  } catch {
    return NextResponse.json({ ok: false, motivo: 'corpo non leggibile' }, { status: 400 })
  }

  const file = modulo.get('volantino')

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, motivo: 'manca il PDF' }, { status: 400 })
  }

  if (file.size > MASSIMO) {
    return NextResponse.json({ ok: false, motivo: 'PDF troppo grande' }, { status: 413 })
  }

  const testo = (campo: string): string | null => {
    const valore = modulo.get(campo)

    return typeof valore === 'string' && valore.trim().length > 0 ? valore.trim() : null
  }

  try {
    const esito = await importaVolantino(await file.arrayBuffer(), {
      insegna: testo('insegna') ?? 'Altro',
      puntoVendita: testo('puntoVendita'),
      validoDal: testo('validoDal'),
      validoAl: testo('validoAl'),
      nomeFile: testo('nomeFile') ?? file.name,
    })

    // Zero offerte non e' un errore di trasporto: e' un volantino che il
    // lettore non ha saputo leggere, e va detto con parole diverse.
    return NextResponse.json({ ok: true, ...esito }, { status: esito.quante > 0 ? 200 : 422 })
  } catch (errore) {
    console.error('import del volantino fallito:', errore)

    return NextResponse.json({ ok: false, motivo: 'import fallito' }, { status: 500 })
  }
}
