import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'

import { db, giornataPasti, giornate } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { alternativeDei, chiaveComponente } from '@/lib/nutrizione/alternative'
import { offertePerAlimenti } from '@/lib/offerte/archivio'
import { NOME_FASCIA, eFascia } from '@/lib/ricette/fasce'
import { NOME_LIVELLO, SPIEGA_LIVELLO } from '@/lib/ricettario/modello'
import { ricettaDelPasto } from '@/lib/ricettario/scelta'

import { cambiaRicetta, sostituisciComponente, spuntaPasto } from '../../azioni-giornata'
import { Navigazione, durata } from '../../componenti/navigazione'

import { AiutiCucina } from './cucina'

export const dynamic = 'force-dynamic'

const stileLivello: Record<string, string> = {
  calza: 'bg-basilico-tenue text-basilico-scuro',
  vicina: 'bg-limone-tenue text-inchiostro',
  adattabile: 'bg-limone-tenue text-inchiostro',
}

export default async function Piatto({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)

  if (!Number.isInteger(id)) notFound()

  const utenteId = await utenteObbligatorio()

  // Il pasto si legge passando dalla giornata, e la giornata ha dentro di chi
  // e'. Senza questa giunzione bastava cambiare il numero nell'indirizzo per
  // aprire la cena di un altro: un id non e' una prova di proprieta'.
  const [riga] = await db()
    .select({ pasto: giornataPasti })
    .from(giornataPasti)
    .innerJoin(giornate, eq(giornate.id, giornataPasti.giornataId))
    .where(and(eq(giornataPasti.id, id), eq(giornate.utenteId, utenteId)))
    .limit(1)

  const pasto = riga?.pasto

  if (!pasto) notFound()

  const ids = pasto.previsti.map((c) => c.alimentoId).filter((i): i is number => i !== null)

  const [ricetta, alternative, offerte] = await Promise.all([
    ricettaDelPasto(pasto.fascia, pasto.previsti, pasto.ricettaLibro),
    alternativeDei(utenteId, [pasto]),
    offertePerAlimenti(ids),
  ])

  // Il segno "in offerta" stava sulla scheda di oggi insieme agli ingredienti,
  // e con loro si e' spostato qui. Solo le offerte certe: sotto la soglia di
  // confidenza un aggancio si mostra come da verificare, mai come un prezzo.
  const inOfferta = new Set(
    [...offerte.entries()].filter(([, o]) => o.some((x) => x.certa)).map(([id]) => id),
  )
  const nomeFascia = eFascia(pasto.fascia) ? NOME_FASCIA[pasto.fascia] : pasto.fascia

  return (
    <>

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
            <header className="scheda overflow-hidden">
              {ricetta.immagineUrl ? (
                <div className="aspect-4/3 w-full overflow-hidden sm:aspect-21/9">
                  {/* eslint-disable-next-line @next/next/no-img-element -- le foto arrivano da domini arbitrari */}
                  <img
                    src={ricetta.immagineUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
              ) : null}

              <div className="p-6">
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
                {ricetta.cambiabile ? (
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

              {/* Una ricetta di altri si cita, e il link ci deve essere: il
                  procedimento qui sotto e' parola loro, i grammi sono tuoi. */}
              {ricetta.fonte ? (
                <p className="mt-4 text-sm text-fumo">
                  Ricetta di{' '}
                  <a
                    href={ricetta.fonte.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-basilico-scuro underline underline-offset-4"
                  >
                    {ricetta.fonte.nome}
                  </a>
                  , coi grammi rifatti sui tuoi.
                </p>
              ) : null}
              </div>
            </header>

            <section className="scheda p-6">
              <h2 className="font-marchio text-xl text-inchiostro">Cosa ti serve</h2>

              {/* Una dose ridotta si dichiara. Chi apre la ricetta alla fonte
                  trova scritto il doppio dell'olio, e senza una riga qui
                  penserebbe a un errore nostro invece che a una scelta. */}
              {pasto.previsti.some((c) => c.ridotto) ? (
                <p className="mt-2 text-sm text-fumo">
                  Qualche dose è più bassa di quella della ricetta: il condimento in cucina si
                  mette abbondante, e qui deve starci dentro la tua giornata.
                </p>
              ) : null}

              <ul className="mt-4 divide-y divide-bordo border-y border-bordo">
                {pasto.previsti.map((c, indice) => {
                  const cambi = alternative.get(chiaveComponente(pasto.id, indice)) ?? []

                  return (
                    <li key={`${c.ruolo}-${c.nome}`} className="py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-inchiostro">
                          {c.nome}
                          {c.alimentoId !== null && inOfferta.has(c.alimentoId) ? (
                            <span className="pillola ml-2 bg-basilico-tenue text-basilico-scuro">
                              in offerta
                            </span>
                          ) : null}
                          {c.ridotto ? (
                            <span className="pillola ml-2 bg-limone-tenue text-inchiostro">
                              ridotto
                            </span>
                          ) : null}
                        </span>
                        <span className="cifre shrink-0 font-semibold text-inchiostro">
                          {c.quantita === 0 ? 'q.b.' : `${c.quantita} ${c.unita}`}
                        </span>
                      </div>

                      {cambi.length > 0 ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-sm text-fumo">
                            Non ce l&rsquo;ho
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1">
                            {cambi.map((alternativa) => (
                              <li key={alternativa.id}>
                                <form action={sostituisciComponente}>
                                  <input type="hidden" name="pasto" value={pasto.id} />
                                  <input type="hidden" name="indice" value={indice} />
                                  <input type="hidden" name="alimento" value={alternativa.id} />
                                  <input type="hidden" name="quantita" value={alternativa.quantita} />
                                  <button
                                    type="submit"
                                    className="rounded-controllo flex w-full items-baseline justify-between gap-3 bg-fondo px-3 py-2 text-left hover:bg-basilico-tenue"
                                  >
                                    <span className="text-sm text-inchiostro">
                                      {alternativa.nome}
                                      {alternativa.fuoriLista ? (
                                        <span className="text-fumo"> · non in lista</span>
                                      ) : null}
                                    </span>
                                    <span className="cifre shrink-0 text-sm font-semibold text-inchiostro">
                                      {alternativa.quantita} {alternativa.unita}
                                    </span>
                                  </button>
                                </form>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs text-fumo">
                            Le quantità non sono le stesse: reggono lo stesso nutriente, non lo
                            stesso peso.
                          </p>
                        </details>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              {ricetta.liberi.length > 0 ? (
                <p className="mt-3 text-sm text-fumo first-letter:uppercase">
                  {ricetta.liberi.join(', ')} q.b.
                </p>
              ) : null}

              <p className="mt-3 text-sm text-fumo">
                I grammi sono quelli del tuo pasto, non quelli della ricetta.
              </p>
            </section>

            {/* Il procedimento tutto su una pagina, come un libro aperto sul
                tavolo. Un passo per schermata sembrava giusto e non lo era:
                per sapere cosa viene dopo dovevi toccare, e per rileggere una
                riga dovevi tornare indietro - con le mani sporche, che e'
                proprio il momento in cui il telefono non lo vuoi toccare. */}
            {ricetta.passi.length > 0 ? (
              <section className="scheda p-6 sm:p-8">
                <h2 className="font-marchio text-xl text-inchiostro">Come si fa</h2>

                <ol className="mt-5 flex flex-col gap-5">
                  {ricetta.passi.map((passo, i) => (
                    <li key={i} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="cifre mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-basilico-tenue text-sm font-semibold text-basilico-scuro"
                      >
                        {i + 1}
                      </span>
                      <p className="text-lg leading-relaxed text-inchiostro first-letter:uppercase">
                        {passo}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <AiutiCucina />

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
      <Navigazione attiva="oggi" />
    </>
  )
}
