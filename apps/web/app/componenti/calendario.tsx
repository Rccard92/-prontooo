import Link from 'next/link'

import type { GiornoDiSettimana } from '@/lib/giornata/componi'
import { INIZIALI, lunediDi, meseEAnno, numeroDelMese, quando, sposta } from '@/lib/giornata/settimana'

/**
 * I sette giorni in cima alla schermata.
 *
 * Non e' solo un modo per cambiare giorno: ogni casella porta le kcal di
 * quella giornata, quindi la settimana si legge tutta insieme senza aprirla
 * giorno per giorno. E' la differenza fra un selettore di date e un piano
 * settimanale.
 *
 * Oggi resta il giorno di partenza e si riconosce sempre, anche quando ne stai
 * guardando un altro: e' il filo che ti riporta indietro.
 */
export function Calendario({
  giorni,
  scelto,
  oggi,
}: {
  giorni: GiornoDiSettimana[]
  scelto: string
  oggi: string
}) {
  const lunedi = lunediDi(scelto)
  const settimanaDiOggi = lunediDi(oggi) === lunedi

  return (
    <nav className="scheda p-3" aria-label="Settimana">
      <div className="flex items-center justify-between gap-2 px-1 pb-3">
        <Freccia href={`/?giorno=${sposta(lunedi, -7)}`} verso="indietro" />

        <p className="text-sm font-semibold text-inchiostro first-letter:uppercase">
          {meseEAnno(lunedi)}
          {settimanaDiOggi ? null : (
            <Link href="/" className="ml-2 text-sm font-semibold text-basilico">
              Torna a oggi
            </Link>
          )}
        </p>

        <Freccia href={`/?giorno=${sposta(lunedi, 7)}`} verso="avanti" />
      </div>

      <ol className="grid grid-cols-7 gap-1">
        {giorni.map((giorno, i) => (
          <li key={giorno.data}>
            <Casella giorno={giorno} iniziale={INIZIALI[i] ?? ''} scelto={scelto} oggi={oggi} />
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Casella({
  giorno,
  iniziale,
  scelto,
  oggi,
}: {
  giorno: GiornoDiSettimana
  iniziale: string
  scelto: string
  oggi: string
}) {
  const attivo = giorno.data === scelto
  const eOggi = giorno.data === oggi
  const passato = quando(giorno.data, oggi) === 'passato'

  // Tre stati e non di piu': quello che stai guardando, oggi, e tutti gli
  // altri. Il giorno passato si smorza perche' non e' li' che si decide.
  const sfondo = attivo
    ? 'bg-basilico text-bianco'
    : eOggi
      ? 'bg-basilico-tenue text-basilico-scuro'
      : passato
        ? 'bg-fondo text-fumo'
        : 'bg-fondo text-inchiostro'

  return (
    <Link
      href={eOggi ? '/' : `/?giorno=${giorno.data}`}
      aria-current={attivo ? 'date' : undefined}
      className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 transition-colors ${sfondo}`}
    >
      <span className={`text-xs font-semibold ${attivo ? 'text-bianco/80' : 'text-fumo'}`}>
        {iniziale}
      </span>

      <span className="cifre text-lg font-semibold leading-none">{numeroDelMese(giorno.data)}</span>

      {/* Le kcal sono il motivo per cui questa non e' una fila di date. Dove
          non c'e' ancora un piano resta un trattino: una casella a zero
          direbbe che quel giorno non mangi. */}
      <span className={`cifre text-[11px] leading-none ${attivo ? 'text-bianco/80' : 'text-fumo'}`}>
        {giorno.esiste ? giorno.kcal : '–'}
      </span>
    </Link>
  )
}

function Freccia({ href, verso }: { href: string; verso: 'indietro' | 'avanti' }) {
  return (
    <Link
      href={href}
      aria-label={verso === 'indietro' ? 'Settimana prima' : 'Settimana dopo'}
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fondo text-fumo"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
        <path
          d={verso === 'indietro' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  )
}
