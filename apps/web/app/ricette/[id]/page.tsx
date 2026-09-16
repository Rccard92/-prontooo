import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'

import { db, ricettaIngredienti, ricette } from '@prontooo/db'

import { Testata, durata } from '../../componenti/testata'

export const dynamic = 'force-dynamic'

async function leggiRicetta(id: number) {
  const [ricetta] = await db().select().from(ricette).where(eq(ricette.id, id)).limit(1)

  if (!ricetta) return null

  const ingredienti = await db()
    .select()
    .from(ricettaIngredienti)
    .where(eq(ricettaIngredienti.ricettaId, id))
    .orderBy(asc(ricettaIngredienti.posizione))

  return { ricetta, ingredienti }
}

function Dato({ nome, valore }: { nome: string; valore: string }) {
  return (
    <div>
      <dt className="text-sm text-carta/60">{nome}</dt>
      <dd className="mt-1 text-lg text-carta">{valore}</dd>
    </div>
  )
}

export default async function PaginaRicetta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numero = Number(id)

  if (!Number.isInteger(numero) || numero <= 0) notFound()

  const trovata = await leggiRicetta(numero)

  if (!trovata) notFound()

  const { ricetta, ingredienti } = trovata

  const dati = [
    ricetta.minutiTotali ? { nome: 'In tutto', valore: durata(ricetta.minutiTotali)! } : null,
    ricetta.minutiPreparazione
      ? { nome: 'Preparazione', valore: durata(ricetta.minutiPreparazione)! }
      : null,
    ricetta.minutiCottura ? { nome: 'Cottura', valore: durata(ricetta.minutiCottura)! } : null,
    ricetta.porzioni ? { nome: 'Porzioni', valore: String(ricetta.porzioni) } : null,
  ].filter((voce) => voce !== null)

  return (
    <div className="min-h-dvh bg-carta">
      <Testata />

      {ricetta.immagineUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- le foto arrivano da domini arbitrari
        <img
          src={ricetta.immagineUrl}
          alt=""
          className="h-[clamp(14rem,38vw,26rem)] w-full object-cover"
        />
      ) : null}

      <div className="bg-inchiostro">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-14">
          <h1 className="font-display text-[clamp(2.25rem,6vw,4rem)] leading-[0.95] text-zagara">
            {ricetta.titolo}
          </h1>

          {ricetta.descrizione ? (
            <p className="mt-5 max-w-2xl text-lg text-carta">{ricetta.descrizione}</p>
          ) : null}

          {dati.length > 0 ? (
            <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-5">
              {dati.map((voce) => (
                <Dato key={voce.nome} nome={voce.nome} valore={voce.valore} />
              ))}
            </dl>
          ) : null}

          <p className="mt-8 text-sm text-carta/60">
            Da{' '}
            <a href={ricetta.fonteUrl} className="text-zagara underline underline-offset-4">
              {ricetta.fonteNome}
            </a>
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-8 lg:grid lg:grid-cols-[22rem_1fr] lg:gap-16">
        <section>
          <h2 className="font-display text-3xl text-inchiostro">Ingredienti</h2>

          <ul className="mt-5 divide-y divide-inchiostro/15 border-t border-inchiostro/15">
            {ingredienti.map((riga) => (
              <li key={riga.id} className="py-3 text-lg text-inchiostro">
                {riga.rigaGrezza}
              </li>
            ))}
          </ul>

          {ricetta.normalizzataIl === null ? (
            <p className="mt-5 border-l-4 border-sangue bg-carta py-2 pl-4 text-base text-inchiostro">
              Ingredienti non ancora normalizzati: di questa ricetta non so gli allergeni. Non
              fidarti di quello che c&rsquo;è scritto qui per decidere se puoi mangiarla.
            </p>
          ) : null}
        </section>

        <section className="mt-12 lg:mt-0">
          <h2 className="font-display text-3xl text-inchiostro">Come si fa</h2>

          {ricetta.passaggi.length === 0 ? (
            <p className="mt-5 text-lg text-inchiostro/70">
              La fonte non pubblica i passaggi in modo leggibile. Aprila sul sito.
            </p>
          ) : (
            <ol className="mt-5 space-y-7">
              {ricetta.passaggi.map((passo, indice) => (
                <li key={indice} className="flex gap-5">
                  <span className="font-display text-4xl leading-none text-cobalto">
                    {indice + 1}
                  </span>
                  <p className="text-lg leading-relaxed text-inchiostro">{passo}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}
