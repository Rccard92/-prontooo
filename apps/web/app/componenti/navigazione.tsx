import Link from 'next/link'

/**
 * La barra in basso, appiccicata al bordo dello schermo.
 *
 * Prima era una testata in alto, e sul telefono mangiava un terzo della
 * schermata: il marchio, poi sette voci che andavano a capo su due righe, e
 * la giornata cominciava a meta' pagina. Qui sotto costa una striscia sola e
 * sta dove arriva il pollice, che e' il posto per cui e' fatta.
 *
 * **Cinque voci, non sette.** Sotto il pollice ogni voce vuole il suo spazio:
 * a sette diventano bersagli da centrare, e un bersaglio da centrare si
 * sbaglia. Gli ingredienti e l'uscita stanno nel profilo - la lista la scrivi
 * una volta, l'uscita la usi quasi mai, e tutte e due sono roba tua.
 */
type Voce = 'oggi' | 'spesa' | 'offerte' | 'storico' | 'profilo'

const VOCI: { href: string; nome: string; chiave: Voce; disegno: string[] }[] = [
  // I disegni sono tracciati a mano qui dentro invece di arrivare da una
  // libreria: sono cinque icone, e una dipendenza per cinque icone e' peso
  // che si porta a ogni caricamento.
  {
    href: '/',
    nome: 'Oggi',
    chiave: 'oggi',
    disegno: ['M4 11h16a8 8 0 0 1-16 0Z', 'M2 20h20', 'M12 3v4'],
  },
  {
    href: '/spesa',
    nome: 'Spesa',
    chiave: 'spesa',
    disegno: ['M6 8h12l1 12H5L6 8Z', 'M9 8a3 3 0 0 1 6 0'],
  },
  {
    href: '/offerte',
    nome: 'Offerte',
    chiave: 'offerte',
    disegno: ['M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z', 'M7.5 7.5h.01'],
  },
  {
    href: '/storico',
    nome: 'Storico',
    chiave: 'storico',
    disegno: ['M6 20v-5', 'M12 20V7', 'M18 20v-9', 'M3 20h18'],
  },
  {
    href: '/profilo',
    nome: 'Profilo',
    chiave: 'profilo',
    disegno: ['M20 21a8 8 0 0 0-16 0', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  },
]

export function Navigazione({ attiva }: { attiva?: Voce }) {
  return (
    <nav
      aria-label="Sezioni"
      // `pb-[env(...)]` e' la barra di casa dell'iPhone: senza, le voci ci
      // finiscono sotto e il tocco lo prende il telefono invece dell'app.
      className="fixed inset-x-0 bottom-0 z-20 border-t border-bordo bg-bianco/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {VOCI.map((voce) => {
          const qui = attiva === voce.chiave

          return (
            <li key={voce.href} className="flex-1">
              <Link
                href={voce.href}
                aria-current={qui ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 px-1 py-2.5 ${
                  qui ? 'text-basilico' : 'text-fumo'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={qui ? 2.2 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6"
                  aria-hidden="true"
                >
                  {voce.disegno.map((tratto) => (
                    <path key={tratto} d={tratto} />
                  ))}
                </svg>

                <span className={`text-[11px] leading-none ${qui ? 'font-semibold' : ''}`}>
                  {voce.nome}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
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
