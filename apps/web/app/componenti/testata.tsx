import Link from 'next/link'

/**
 * Testata unica dell'app: bianca, appoggiata sul fondo, le voci sono pillole.
 */
export function Testata({ attiva }: { attiva?: 'settimana' | 'catalogo' | 'wizard' }) {
  const voce = 'rounded-full px-3 py-1.5 text-sm font-semibold text-fumo'
  const voceAttiva =
    'rounded-full bg-basilico-tenue px-3 py-1.5 text-sm font-semibold text-basilico-scuro'

  return (
    <header className="sticky top-0 z-10 border-b border-bordo bg-bianco/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-marchio text-2xl leading-none text-inchiostro">
          èProntooo
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/" className={attiva === 'settimana' ? voceAttiva : voce}>
            Settimana
          </Link>
          <Link href="/ricette" className={attiva === 'catalogo' ? voceAttiva : voce}>
            Ricette
          </Link>
          <Link href="/wizard" className={attiva === 'wizard' ? voceAttiva : voce}>
            Preferenze
          </Link>
        </nav>
      </div>
    </header>
  )
}

/** Tempo e porzioni si scrivono sempre allo stesso modo in tutta l'app. */
export function durata(minuti: number | null): string | null {
  if (minuti === null) return null
  if (minuti < 60) return `${minuti} min`

  const ore = Math.floor(minuti / 60)
  const resto = minuti % 60

  return resto === 0 ? `${ore} h` : `${ore} h ${resto} min`
}
