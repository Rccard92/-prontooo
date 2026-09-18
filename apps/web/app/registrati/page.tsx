import Link from 'next/link'
import { redirect } from 'next/navigation'

import { servelInvito, utenteCorrenteId } from '@/lib/accesso/sessione'

import { iscriviti } from '../entra/azioni'

export const dynamic = 'force-dynamic'

export default async function Registrati({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  if ((await utenteCorrenteId()) !== null) redirect('/')

  const { errore } = await searchParams
  const invitoNecessario = await servelInvito()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-fondo px-4 py-10">
      <div className="scheda w-full max-w-sm p-8">
        <h1 className="font-marchio text-3xl text-inchiostro">Il tuo pannello</h1>
        <p className="mt-2 text-base text-fumo">
          {invitoNecessario
            ? 'La tua dieta, i tuoi giorni, il tuo peso: separati da quelli degli altri.'
            : 'Sei il primo. Da qui nasce tutto il resto.'}
        </p>

        <form action={iscriviti} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-inchiostro">Come ti chiami</span>
            <input
              name="nome"
              type="text"
              required
              autoFocus
              autoComplete="name"
              className="rounded-controllo border border-bordo bg-fondo px-4 py-3 text-base text-inchiostro outline-none focus:border-basilico"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-inchiostro">Email</span>
            <input
              name="email"
              type="email"
              required
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
              minLength={8}
              autoComplete="new-password"
              className="rounded-controllo border border-bordo bg-fondo px-4 py-3 text-base text-inchiostro outline-none focus:border-basilico"
            />
            <span className="text-xs text-fumo">Almeno otto caratteri.</span>
          </label>

          {invitoNecessario ? (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-inchiostro">Codice invito</span>
              <input
                name="invito"
                type="text"
                required
                className="rounded-controllo border border-bordo bg-fondo px-4 py-3 text-base text-inchiostro outline-none focus:border-basilico"
              />
              <span className="text-xs text-fumo">
                Te lo dà chi usa già l&rsquo;app: l&rsquo;indirizzo è pubblico, e senza codice
                chiunque lo indovini si farebbe un pannello qui dentro.
              </span>
            </label>
          ) : null}

          <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
            Crea il pannello
          </button>
        </form>

        {errore ? (
          <p className="rounded-controllo mt-5 bg-pomodoro-tenue px-4 py-3 text-sm text-pomodoro">
            {errore}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-fumo">
          Ce l&rsquo;hai già?{' '}
          <Link href="/entra" className="font-semibold text-basilico-scuro underline underline-offset-4">
            Entra
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
