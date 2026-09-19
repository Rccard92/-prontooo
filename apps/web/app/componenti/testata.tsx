import Link from 'next/link'

import { esciDallApp } from '../entra/azioni'

/** Testata unica dell'app: bianca, appoggiata sul fondo, le voci sono pillole. */
export function Testata({
  attiva,
  nome,
}: {
  attiva?: 'oggi' | 'ingredienti' | 'spesa' | 'offerte' | 'storico' | 'profilo' | 'ricette' | 'settimana' | 'catalogo' | 'wizard'
  /** Chi sta guardando: si mostra solo dove serve saperlo. */
  nome?: string
}) {
  const voce = 'rounded-full px-3 py-1.5 text-sm font-semibold text-fumo'
  const voceAttiva =
    'rounded-full bg-basilico-tenue px-3 py-1.5 text-sm font-semibold text-basilico-scuro'

  const voci: { href: string; nome: string; chiave: string }[] = [
    { href: '/', nome: 'Oggi', chiave: 'oggi' },
    { href: '/ingredienti', nome: 'Ingredienti', chiave: 'ingredienti' },
    { href: '/spesa', nome: 'Spesa', chiave: 'spesa' },
    { href: '/offerte', nome: 'Offerte', chiave: 'offerte' },
    { href: '/storico', nome: 'Storico', chiave: 'storico' },
    { href: '/profilo', nome: 'Profilo', chiave: 'profilo' },
  ]

  return (
    <header className="sticky top-0 z-10 border-b border-bordo bg-bianco/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-marchio text-2xl leading-none text-inchiostro">
          èProntooo
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {voci.map((v) => (
            <Link key={v.href} href={v.href} className={attiva === v.chiave ? voceAttiva : voce}>
              {v.nome}
            </Link>
          ))}

          <form action={esciDallApp}>
            <button type="submit" className={voce} title={nome ? `Sei entrato come ${nome}` : undefined}>
              {nome ? `Esci (${nome})` : 'Esci'}
            </button>
          </form>
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
