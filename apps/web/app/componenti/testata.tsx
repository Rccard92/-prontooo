import Link from 'next/link'

/**
 * Testata unica dell'app. Su fondo inchiostro pieno, staccata per colore dal
 * contenuto sotto: niente bordo, niente ombra.
 */
export function Testata({ attiva }: { attiva?: 'catalogo' | 'importa' }) {
  const voce = 'text-base text-carta/70 hover:text-carta'
  const voceAttiva = 'text-base text-zagara'

  return (
    <header className="bg-inchiostro">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-4 py-5 sm:px-8">
        <Link href="/" className="font-display text-3xl leading-none text-zagara sm:text-4xl">
          èProntooo
        </Link>
        <nav className="flex items-baseline gap-6">
          <Link href="/" className={attiva === 'catalogo' ? voceAttiva : voce}>
            Catalogo
          </Link>
          <Link href="/importa" className={attiva === 'importa' ? voceAttiva : voce}>
            Importa
          </Link>
          <Link href="/stato" className={voce}>
            Stato
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
