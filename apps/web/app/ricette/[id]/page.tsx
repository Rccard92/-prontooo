import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'

import { db, ricettaIngredienti, ricette } from '@prontooo/db'

import { Navigazione, durata } from '../../componenti/navigazione'

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
    <div className="rounded-controllo bg-fondo px-4 py-3">
      <dt className="text-xs font-semibold text-fumo">{nome}</dt>
      <dd className="cifre mt-0.5 text-base font-bold text-inchiostro">{valore}</dd>
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
    <div className="min-h-dvh bg-fondo">
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <article className="scheda overflow-hidden">
          {ricetta.immagineUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- le foto arrivano da domini arbitrari
            <img
              src={ricetta.immagineUrl}
              alt=""
              className="h-[clamp(12rem,34vw,22rem)] w-full object-cover"
            />
          ) : null}

          <div className="p-6 sm:p-10">
            <h1 className="font-marchio text-[clamp(1.9rem,5vw,3rem)] leading-tight text-inchiostro">
              {ricetta.titolo}
            </h1>

            {ricetta.descrizione ? (
              <p className="mt-3 max-w-2xl text-base text-fumo">{ricetta.descrizione}</p>
            ) : null}

            {dati.length > 0 ? (
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {dati.map((voce) => (
                  <Dato key={voce.nome} nome={voce.nome} valore={voce.valore} />
                ))}
              </dl>
            ) : null}

            <div className="mt-10 lg:grid lg:grid-cols-[20rem_1fr] lg:gap-12">
              <section>
                <h2 className="font-marchio text-2xl text-inchiostro">Ingredienti</h2>

                <ul className="mt-4 flex flex-col gap-1">
                  {ingredienti.map((riga) => (
                    <li
                      key={riga.id}
                      className="rounded-controllo bg-fondo px-4 py-2.5 text-base text-inchiostro"
                    >
                      {riga.rigaGrezza}
                    </li>
                  ))}
                </ul>

                {ricetta.normalizzataIl === null ? (
                  <p className="rounded-controllo bg-pomodoro-tenue mt-4 px-4 py-3 text-sm text-pomodoro">
                    Ingredienti non ancora normalizzati: di questa ricetta non so gli allergeni. Non
                    fidarti di questa pagina per decidere se puoi mangiarla.
                  </p>
                ) : null}
              </section>

              <section className="mt-10 lg:mt-0">
                <h2 className="font-marchio text-2xl text-inchiostro">Come si fa</h2>

                {ricetta.passaggi.length === 0 ? (
                  <p className="mt-4 text-base text-fumo">
                    La fonte non pubblica i passaggi in modo leggibile. Aprila sul sito.
                  </p>
                ) : (
                  <ol className="mt-4 flex flex-col gap-5">
                    {ricetta.passaggi.map((passo, indice) => (
                      <li key={indice} className="flex gap-4">
                        <span className="cifre bg-basilico-tenue text-basilico-scuro flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                          {indice + 1}
                        </span>
                        <p className="pt-1 text-base leading-relaxed text-inchiostro">{passo}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            <p className="mt-10 border-t border-bordo pt-5 text-sm text-fumo">
              Da{' '}
              <a
                href={ricetta.fonteUrl}
                className="text-basilico-scuro font-semibold underline underline-offset-4"
              >
                {ricetta.fonteNome}
              </a>
            </p>
          </div>
        </article>
      </main>
      <Navigazione />
    </div>
  )
}
