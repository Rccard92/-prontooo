import { redirect } from 'next/navigation'

import { importaDaUrl } from '@/lib/ricette/importa'

import { Testata } from '../componenti/testata'

export const dynamic = 'force-dynamic'

async function importa(dati: FormData) {
  'use server'

  const indirizzo = String(dati.get('url') ?? '')

  if (!indirizzo.trim()) {
    redirect('/importa?errore=' + encodeURIComponent('Incolla il link della ricetta.'))
  }

  const esito = await importaDaUrl(indirizzo)

  if (!esito.ok) {
    redirect('/importa?errore=' + encodeURIComponent(esito.motivo))
  }

  redirect(`/ricette/${esito.id}`)
}

export default async function Importa({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  const { errore } = await searchParams

  return (
    <div className="min-h-dvh bg-fondo">
      <Testata />

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="scheda p-6 sm:p-10">
          <h1 className="font-marchio text-3xl leading-tight text-inchiostro sm:text-4xl">
            Incolla una ricetta
          </h1>
          <p className="mt-3 text-base text-fumo">
            Serve solo finché il catalogo non si riempie da solo. Il link deve puntare alla ricetta,
            non alla categoria.
          </p>

          <form action={importa} className="mt-8">
            <label htmlFor="url" className="block text-sm font-semibold text-inchiostro">
              Indirizzo della ricetta
            </label>
            <input
              id="url"
              name="url"
              type="url"
              required
              autoComplete="off"
              placeholder="https://www.giallozafferano.it/ricette/..."
              className="rounded-controllo mt-2 w-full border border-bordo bg-fondo px-4 py-3 text-base text-inchiostro outline-none placeholder:text-fumo/60 focus:border-basilico"
            />
            <button type="submit" className="bottone mt-6 w-full hover:bg-basilico-scuro sm:w-auto">
              Porta dentro la ricetta
            </button>
          </form>

          {errore ? (
            <p className="rounded-controllo bg-pomodoro-tenue mt-6 px-4 py-3 text-sm text-pomodoro">
              {errore}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  )
}
