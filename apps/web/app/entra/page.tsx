import { redirect } from 'next/navigation'

import { entra, protezioneAttiva } from '@/lib/accesso/sessione'

export const dynamic = 'force-dynamic'

async function accedi(dati: FormData) {
  'use server'

  const riuscito = await entra(String(dati.get('passphrase') ?? ''))

  redirect(riuscito ? '/' : '/entra?errore=1')
}

export default async function Entra({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  if (!protezioneAttiva()) redirect('/')

  const { errore } = await searchParams

  return (
    <div className="flex min-h-dvh items-center justify-center bg-fondo px-4">
      <div className="scheda w-full max-w-sm p-8">
        <h1 className="font-marchio text-3xl text-inchiostro">èProntooo</h1>
        <p className="mt-2 text-base text-fumo">Qui dentro c&rsquo;è cosa mangi. Serve la passphrase.</p>

        <form action={accedi} className="mt-6">
          <label htmlFor="passphrase" className="block text-sm font-semibold text-inchiostro">
            Passphrase
          </label>
          <input
            id="passphrase"
            name="passphrase"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className="rounded-controllo mt-2 w-full border border-bordo bg-fondo px-4 py-3 text-base text-inchiostro outline-none focus:border-basilico"
          />
          <button type="submit" className="bottone mt-5 w-full hover:bg-basilico-scuro">
            Entra
          </button>
        </form>

        {errore ? (
          <p className="rounded-controllo bg-pomodoro-tenue mt-5 px-4 py-3 text-sm text-pomodoro">
            Passphrase sbagliata.
          </p>
        ) : null}
      </div>
    </div>
  )
}
