import { count } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { allergeni, db } from '@cassetta/db'

export const dynamic = 'force-dynamic'

/**
 * Sonda usata dall'healthcheck di Railway. Se il database non risponde il deploy
 * non deve essere considerato buono: meglio tenere in linea quello precedente.
 */
export async function GET() {
  try {
    const [riga] = await db().select({ n: count() }).from(allergeni)

    return NextResponse.json({
      ok: true,
      database: 'collegato',
      allergeni: riga?.n ?? 0,
      istante: new Date().toISOString(),
    })
  } catch (errore) {
    return NextResponse.json(
      {
        ok: false,
        database: 'non raggiungibile',
        errore: errore instanceof Error ? errore.message : 'errore sconosciuto',
        istante: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}
