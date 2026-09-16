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
    <div className="min-h-dvh bg-carta">
      <Testata attiva="importa" />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="cornice">
          <div className="cornice-interna bg-cobalto px-6 py-12 sm:px-12">
            <h1 className="font-display text-4xl leading-tight text-zagara sm:text-5xl">
              Incolla una ricetta
            </h1>
            <p className="mt-4 max-w-xl text-lg text-carta">
              Il link diretto alla ricetta, non alla categoria. Leggo titolo, tempi, porzioni,
              ingredienti e passaggi.
            </p>

            <form action={importa} className="mt-10">
              <label htmlFor="url" className="block text-base text-carta">
                Indirizzo della ricetta
              </label>
              <input
                id="url"
                name="url"
                type="url"
                required
                autoComplete="off"
                placeholder="https://www.giallozafferano.it/ricette/..."
                className="mt-2 w-full border-b-2 border-zagara bg-transparent pb-2 text-lg text-carta outline-none placeholder:text-carta/40 focus:border-carta"
              />
              <button
                type="submit"
                className="mt-8 bg-zagara px-6 py-3 text-lg text-inchiostro"
              >
                Porta dentro la ricetta
              </button>
            </form>

            {errore ? (
              <p className="mt-8 border-l-4 border-sangue bg-inchiostro px-4 py-3 text-base text-carta">
                {errore}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
