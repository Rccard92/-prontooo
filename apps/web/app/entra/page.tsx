import Link from 'next/link'
import { redirect } from 'next/navigation'

import { quantiUtenti, utenteCorrenteId } from '@/lib/accesso/sessione'

import { entra } from './azioni'

export const dynamic = 'force-dynamic'

export default async function Entra({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  if ((await utenteCorrenteId()) !== null) redirect('/')

  // Nessun utente: non c'e' niente in cui entrare, si comincia iscrivendosi.
  if ((await quantiUtenti()) === 0) redirect('/registrati')

  const { errore } = await searchParams

  return (
    <div className="flex min-h-dvh items-center justify-center bg-fondo px-4 py-10">
      <div className="scheda w-full max-w-sm p-8">
        <h1 className="font-marchio text-3xl text-inchiostro">èProntooo</h1>
        <p className="mt-2 text-base text-fumo">
          Qui dentro c&rsquo;è cosa mangi. Entra nel tuo pannello.
        </p>

        <form action={entra} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-inchiostro">Email</span>
            <input
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="rounded-controllo border border-bordo bg-fondo px-4 py-3 text-base text-inchiostro outline-none focus:border-basilico"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-inchiostro">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-controllo border border-bordo bg-fondo px-4 py-3 text-base text-inchiostro outline-none focus:border-basilico"
            />
          </label>

          <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
            Entra
          </button>
        </form>

        {errore ? (
          <p className="rounded-controllo mt-5 bg-pomodoro-tenue px-4 py-3 text-sm text-pomodoro">
            {errore}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-fumo">
          Ti serve un pannello tuo?{' '}
          <Link href="/registrati" className="font-semibold text-basilico-scuro underline underline-offset-4">
            Iscriviti
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
