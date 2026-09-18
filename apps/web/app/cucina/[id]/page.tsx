import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db, giornataPasti } from '@prontooo/db'

import { NOME_FASCIA, eFascia } from '@/lib/ricette/fasce'
import { NOME_LIVELLO, SPIEGA_LIVELLO } from '@/lib/ricettario/modello'
import { ricettaDelPasto } from '@/lib/ricettario/scelta'

import { cambiaRicetta, spuntaPasto } from '../../azioni-giornata'
import { Testata, durata } from '../../componenti/testata'

import { Cucina } from './cucina'

export const dynamic = 'force-dynamic'

const stileLivello: Record<string, string> = {
  calza: 'bg-basilico-tenue text-basilico-scuro',
  vicina: 'bg-limone-tenue text-inchiostro',
  adattabile: 'bg-limone-tenue text-inchiostro',
}

export default async function Piatto({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)

  if (!Number.isInteger(id)) notFound()

  const [pasto] = await db().select().from(giornataPasti).where(eq(giornataPasti.id, id)).limit(1)

  if (!pasto) notFound()

  const ricetta = await ricettaDelPasto(pasto.fascia, pasto.previsti, pasto.ricettaLibro)
  const nomeFascia = eFascia(pasto.fascia) ? NOME_FASCIA[pasto.fascia] : pasto.fascia

  return (
    <>
      <Testata attiva="oggi" />

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-fumo hover:text-basilico">
          Torna a oggi
        </Link>

        {!ricetta ? (
          <section className="scheda p-6">
            <h1 className="font-marchio text-2xl text-inchiostro">
              Per questo pasto non c&rsquo;è una ricetta
            </h1>
            <p className="mt-2 text-fumo">
              I componenti ci sono, ma nessuna ricetta del ricettario li mette insieme. Mangiali
              come sono: è un pasto completo lo stesso.
            </p>
            <ul className="mt-4 flex flex-col gap-1.5">
              {pasto.previsti.map((c) => (
                <li
                  key={`${c.ruolo}-${c.nome}`}
                  className="rounded-controllo flex items-baseline justify-between gap-3 bg-fondo px-3 py-2"
                >
                  <span className="text-inchiostro">{c.nome}</span>
                  <span className="cifre shrink-0 font-bold text-inchiostro">
                    {c.quantita === 0 ? 'q.b.' : `${c.quantita} ${c.unita}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            <header className="scheda p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pillola bg-fondo text-fumo">{nomeFascia}</span>
                <span className={`pillola ${stileLivello[ricetta.livello]}`}>
                  {NOME_LIVELLO[ricetta.livello]}
                </span>
                <span className="cifre text-sm text-fumo">{durata(ricetta.minuti)}</span>
              </div>

              <h1 className="font-marchio mt-3 text-3xl leading-tight text-inchiostro sm:text-4xl">
                {ricetta.titolo}
              </h1>
              <p className="mt-1 text-fumo">{SPIEGA_LIVELLO[ricetta.livello]}</p>

              {ricetta.mancanti.length > 0 ? (
                <p className="rounded-controllo mt-4 bg-limone-tenue px-4 py-3 text-sm text-inchiostro">
                  Ti manca: {ricetta.mancanti.join(', ')}. Il resto ce l&rsquo;hai.
                </p>
              ) : null}

              {ricetta.avanzati.length > 0 ? (
                <p className="rounded-controllo mt-3 bg-fondo px-4 py-3 text-sm text-fumo">
                  Fuori dalla ricetta, ma del pasto: {ricetta.avanzati.join(', ')}.
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <form action={spuntaPasto}>
                  <input type="hidden" name="pasto" value={pasto.id} />
                  <button type="submit" className="bottone hover:bg-basilico-scuro">
                    L&rsquo;ho mangiato
                  </button>
                </form>
                {ricetta.alternative.length > 0 ? (
                  <form action={cambiaRicetta}>
                    <input type="hidden" name="pasto" value={pasto.id} />
                    <button
                      type="submit"
                      className="bottone-chiaro hover:bg-basilico hover:text-bianco"
                    >
                      Cambia ricetta
                    </button>
                  </form>
                ) : null}
              </div>
            </header>

            <section className="scheda p-6">
              <h2 className="font-marchio text-xl text-inchiostro">Cosa ti serve</h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {ricetta.occorrente.map((riga, i) => (
                  <li
                    key={i}
                    className="rounded-controllo cifre bg-fondo px-3 py-2 text-inchiostro first-letter:uppercase"
                  >
                    {riga}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-fumo">
                I grammi sono quelli del tuo pasto, non quelli della ricetta.
              </p>
            </section>

            <Cucina passi={ricetta.passi} titolo={ricetta.titolo} />

            {ricetta.nota ? (
              <p className="rounded-scheda bg-limone-tenue px-5 py-4 text-inchiostro">
                {ricetta.nota}
              </p>
            ) : null}

            {ricetta.alternative.length > 0 ? (
              <section className="scheda p-6">
                <h2 className="font-marchio text-xl text-inchiostro">Altre con gli stessi grammi</h2>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {ricetta.alternative.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-controllo flex items-center justify-between gap-3 bg-fondo px-3 py-2"
                    >
                      <span className="text-inchiostro">{a.titolo}</span>
                      <span className={`pillola shrink-0 ${stileLivello[a.livello]}`}>
                        {NOME_LIVELLO[a.livello]}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  )
}
