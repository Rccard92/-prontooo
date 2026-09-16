import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { count, eq as uguale } from 'drizzle-orm'

import { db, pianiPasti, ricette } from '@prontooo/db'

import { cambiaPasto, generaPiano, leggiPiano, leggiProfilo } from '@/lib/piano/genera'
import { GIORNI, dataDelGiorno, lunediDi } from '@/lib/piano/settimana'
import { NOME_FASCIA, eFascia } from '@/lib/ricette/fasce'

import { Testata, durata } from './componenti/testata'

export const dynamic = 'force-dynamic'

const stileFascia: Record<string, string> = {
  colazione: 'bg-limone-tenue text-inchiostro',
  spuntino: 'bg-limone-tenue text-inchiostro',
  merenda: 'bg-limone-tenue text-inchiostro',
  pranzo: 'bg-basilico-tenue text-basilico-scuro',
  cena: 'bg-pomodoro-tenue text-pomodoro',
}

async function genera() {
  'use server'

  await generaPiano()
  revalidatePath('/')
}

async function cambia(dati: FormData) {
  'use server'

  const id = Number(dati.get('pasto'))

  if (Number.isInteger(id)) await cambiaPasto(id)

  revalidatePath('/')
}

async function blocca(dati: FormData) {
  'use server'

  const id = Number(dati.get('pasto'))
  const nuovo = dati.get('bloccato') !== 'si'

  if (Number.isInteger(id)) {
    await db().update(pianiPasti).set({ bloccato: nuovo }).where(uguale(pianiPasti.id, id))
  }

  revalidatePath('/')
}

type Pasto = NonNullable<Awaited<ReturnType<typeof leggiPiano>>>['pasti'][number]

function Pasto({ pasto }: { pasto: Pasto }) {
  const nome = eFascia(pasto.fascia) ? NOME_FASCIA[pasto.fascia] : pasto.fascia
  const tempo = durata(pasto.minutiTotali)

  return (
    <div className="scheda flex gap-4 p-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-controllo bg-basilico-tenue sm:size-24">
        {pasto.immagineUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- le foto arrivano da domini arbitrari
          <img src={pasto.immagineUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`pillola self-start ${stileFascia[pasto.fascia] ?? 'bg-basilico-tenue text-basilico-scuro'}`}>
          {nome}
        </span>

        {pasto.ricettaId ? (
          <Link
            href={`/ricette/${pasto.ricettaId}`}
            className="mt-1.5 text-base leading-snug font-bold text-inchiostro"
          >
            {pasto.titolo}
          </Link>
        ) : (
          <p className="mt-1.5 text-base font-bold text-fumo">Niente di adatto in catalogo</p>
        )}

        <p className="cifre mt-1 text-sm text-fumo">
          {[tempo, `${pasto.porzioni} porzioni`].filter(Boolean).join(' · ')}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-2">
          <form action={cambia}>
            <input type="hidden" name="pasto" value={pasto.id} />
            <button type="submit" className="bottone-chiaro hover:bg-basilico hover:text-bianco">
              Cambia ricetta
            </button>
          </form>

          <form action={blocca}>
            <input type="hidden" name="pasto" value={pasto.id} />
            <input type="hidden" name="bloccato" value={pasto.bloccato ? 'si' : 'no'} />
            <button
              type="submit"
              className={`pillola ${
                pasto.bloccato ? 'bg-limone text-inchiostro' : 'bg-fondo text-fumo'
              }`}
            >
              {pasto.bloccato ? 'Tenuto fermo' : 'Tieni fermo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default async function Settimana() {
  let profiloSalvato = null
  let piano = null
  let quanteRicette = 0

  try {
    profiloSalvato = await leggiProfilo()
    piano = await leggiPiano()
    const [c] = await db().select({ n: count() }).from(ricette)
    quanteRicette = c?.n ?? 0
  } catch (errore) {
    console.error('lettura della settimana fallita:', errore)

    return (
      <div className="min-h-dvh bg-fondo">
        <Testata attiva="settimana" />
        <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <div className="scheda px-6 py-12 text-center">
            <h1 className="font-marchio text-2xl text-pomodoro">Il database non risponde</h1>
            <p className="mt-2 text-base text-fumo">Il dettaglio sta nei log del deploy.</p>
          </div>
        </main>
      </div>
    )
  }

  if (!profiloSalvato) redirect('/wizard')

  const inizio = lunediDi()

  return (
    <div className="min-h-dvh bg-fondo">
      <Testata attiva="settimana" />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">La settimana</h1>
            <p className="cifre mt-1 text-sm text-fumo">
              dal {dataDelGiorno(inizio, 0)} al {dataDelGiorno(inizio, 6)}
            </p>
          </div>

          <form action={genera}>
            <button type="submit" className="bottone hover:bg-basilico-scuro">
              {piano ? 'Rigenera la settimana' : 'Genera la settimana'}
            </button>
          </form>
        </div>

        {quanteRicette === 0 ? (
          <div className="scheda mt-6 px-6 py-10 text-center">
            <h2 className="font-marchio text-2xl text-inchiostro">Il catalogo è ancora vuoto</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-fumo">
              Il worker sta raccogliendo le ricette dai siti. Ci mette qualche minuto al primo giro:
              torna fra poco e premi Genera.
            </p>
            <Link href="/importa" className="bottone-chiaro mt-6">
              Oppure incollane una a mano
            </Link>
          </div>
        ) : null}

        {piano === null ? (
          quanteRicette > 0 ? (
            <div className="scheda mt-6 px-6 py-10 text-center">
              <h2 className="font-marchio text-2xl text-inchiostro">
                {quanteRicette} ricette pronte
              </h2>
              <p className="mx-auto mt-2 max-w-md text-base text-fumo">
                Premi Genera la settimana e ti riempio i pasti che hai scelto nel wizard.
              </p>
            </div>
          ) : null
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {GIORNI.map((giorno, indice) => {
              const delGiorno = piano.pasti.filter((p) => p.giorno === indice)

              if (delGiorno.length === 0) return null

              return (
                <section key={giorno}>
                  <h2 className="font-marchio text-xl text-inchiostro">
                    {giorno}{' '}
                    <span className="cifre text-base font-normal text-fumo">
                      {dataDelGiorno(inizio, indice)}
                    </span>
                  </h2>

                  <div className="mt-3 flex flex-col gap-3">
                    {delGiorno.map((pasto) => (
                      <Pasto key={pasto.id} pasto={pasto} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
