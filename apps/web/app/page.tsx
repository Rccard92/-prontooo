import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { count, eq as uguale } from 'drizzle-orm'

import { db, pianiPasti, ricette } from '@prontooo/db'

import { cambiaPasto, generaPiano, leggiPiano, leggiProfilo } from '@/lib/piano/genera'
import { GIORNI, dataDelGiorno, lunediDi } from '@/lib/piano/settimana'
import { NOME_RUOLO } from '@/lib/nutrizione/componi'
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

  return (
    <div className="scheda p-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`pillola ${stileFascia[pasto.fascia] ?? 'bg-basilico-tenue text-basilico-scuro'}`}
        >
          {nome}
        </span>

        <form action={blocca}>
          <input type="hidden" name="pasto" value={pasto.id} />
          <input type="hidden" name="bloccato" value={pasto.bloccato ? 'si' : 'no'} />
          <button
            type="submit"
            className={`pillola ${pasto.bloccato ? 'bg-limone text-inchiostro' : 'bg-fondo text-fumo'}`}
          >
            {pasto.bloccato ? 'Tenuto fermo' : 'Tieni fermo'}
          </button>
        </form>
      </div>

      {pasto.componenti.length === 0 ? (
        <p className="mt-3 text-base text-fumo">
          Niente di adatto: le esclusioni tolgono troppo per questa fascia.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {pasto.componenti.map((c) => (
            <li
              key={`${c.ruolo}-${c.alimentoId}`}
              className="rounded-controllo flex items-baseline justify-between gap-3 bg-fondo px-3 py-2"
            >
              <span className="text-base text-inchiostro">
                {c.nome}
                <span className="ml-2 text-xs text-fumo">{NOME_RUOLO[c.ruolo] ?? c.ruolo}</span>
              </span>
              <span className="cifre shrink-0 text-base font-bold text-inchiostro">
                {c.quantita} {c.unita}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pasto.ricettaId ? (
        <Link
          href={`/ricette/${pasto.ricettaId}`}
          className="rounded-controllo mt-3 flex items-center gap-3 bg-basilico-tenue px-3 py-2"
        >
          {pasto.immagineUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- le foto arrivano da domini arbitrari
            <img
              src={pasto.immagineUrl}
              alt=""
              loading="lazy"
              className="size-10 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-basilico-scuro">Idea per cucinarli</span>
            <span className="block truncate text-sm text-inchiostro">{pasto.titolo}</span>
          </span>
        </Link>
      ) : null}

      <form action={cambia} className="mt-3">
        <input type="hidden" name="pasto" value={pasto.id} />
        <button type="submit" className="bottone-chiaro hover:bg-basilico hover:text-bianco">
          Cambia pasto
        </button>
      </form>
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

        {piano === null ? (
          <div className="scheda mt-6 px-6 py-10 text-center">
            <h2 className="font-marchio text-2xl text-inchiostro">Nessun piano per questa settimana</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-fumo">
              Premi Genera la settimana: compongo i pasti con gli alimenti che hai scelto e i grammi
              giusti. Le {quanteRicette} ricette in catalogo servono come idee per cucinarli.
            </p>
          </div>
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
