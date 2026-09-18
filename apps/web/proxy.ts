import { NextResponse, type NextRequest } from 'next/server'

/**
 * Chiude l'app a chi non ha una sessione.
 *
 * Qui si controlla solo che il cookie **ci sia**: la firma si verifica nelle
 * pagine, dove il runtime Node ha i moduli di crittografia. Questa e' la
 * prima porta, non l'unica - ogni query filtra comunque per utente.
 *
 * Adesso e' sempre attiva: non c'e' piu' il caso "app senza password". I dati
 * qui dentro sono di qualcuno, e devono avere un proprietario.
 */
const APERTE = ['/entra', '/registrati', '/api/health', '/_next', '/favicon', '/icona', '/apple-touch-icon', '/manifest', '/sw.js']

export default function proxy(richiesta: NextRequest) {
  const percorso = richiesta.nextUrl.pathname

  if (APERTE.some((a) => percorso.startsWith(a))) return NextResponse.next()

  // La rotta interna si difende col suo segreto condiviso, non col cookie.
  if (percorso.startsWith('/api/interno')) return NextResponse.next()

  if (richiesta.cookies.has('eprontooo_sessione')) return NextResponse.next()

  const destinazione = richiesta.nextUrl.clone()
  destinazione.pathname = '/entra'
  destinazione.search = ''

  return NextResponse.redirect(destinazione)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
