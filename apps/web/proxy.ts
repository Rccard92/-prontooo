import { NextResponse, type NextRequest } from 'next/server'

/**
 * Chiude l'app a chi non ha il cookie di accesso.
 *
 * Qui si controlla solo che il cookie **ci sia**: la firma si verifica nelle
 * pagine, dove il runtime Node ha i moduli di crittografia. Questa e' la
 * prima porta, non l'unica.
 */
const APERTE = ['/entra', '/api/health', '/_next', '/favicon']

export default function proxy(richiesta: NextRequest) {
  if (!process.env.APP_PASSPHRASE) return NextResponse.next()

  const percorso = richiesta.nextUrl.pathname

  if (APERTE.some((a) => percorso.startsWith(a))) return NextResponse.next()

  // La rotta interna si difende col suo segreto condiviso, non col cookie.
  if (percorso.startsWith('/api/interno')) return NextResponse.next()

  if (richiesta.cookies.has('eprontooo_accesso')) return NextResponse.next()

  const destinazione = richiesta.nextUrl.clone()
  destinazione.pathname = '/entra'
  destinazione.search = ''

  return NextResponse.redirect(destinazione)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
