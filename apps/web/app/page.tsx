import Link from 'next/link'
import { redirect } from 'next/navigation'

import { utenteConProfilo, utenteCorrente } from '@/lib/accesso/sessione'
import { GRUPPI_FUORI, PIATTI_FUORI } from '@/lib/giornata/piatti'
import {
  type Scoperta,
  leggiGiornata,
  oggi,
  scopertePerUtente,
  settimana,
} from '@/lib/giornata/componi'
import { eData, quando, settimanaDi } from '@/lib/giornata/settimana'
import { NOME_TIPO_GIORNO, TIPI_GIORNO, type TipoGiorno } from '@/lib/giornata/modello'
import { listaAttiva } from '@/lib/lista/archivio'
import { NOME_FASCIA, eFascia } from '@/lib/ricette/fasce'
import { type AlternativeDiPasto, alternativeDei, chiaveComponente } from '@/lib/nutrizione/alternative'
import { offertePerAlimenti } from '@/lib/offerte/archivio'
import { NOME_LIVELLO } from '@/lib/ricettario/modello'
import { type RicettaDelPasto, ricetteDeiPasti } from '@/lib/ricettario/scelta'

import {
  annullaRegistrazione,
  cambiaPasto,
  cambiaRicetta,
  sostituisciComponente,
  cambiaTipoGiorno,
  generaGiorno,
  registraFuori,
  saltaPasto,
  spuntaPasto,
} from './azioni-giornata'
import { Calendario } from './componenti/calendario'
import { Navigazione, durata } from './componenti/navigazione'

export const dynamic = 'force-dynamic'

const stileFascia: Record<string, string> = {
  colazione: 'bg-limone-tenue text-inchiostro',
  spuntino: 'bg-limone-tenue text-inchiostro',
  merenda: 'bg-limone-tenue text-inchiostro',
  pranzo: 'bg-basilico-tenue text-basilico-scuro',
  cena: 'bg-pomodoro-tenue text-pomodoro',
}

type Pasto = NonNullable<Awaited<ReturnType<typeof leggiGiornata>>>['pasti'][number]

const stileLivello: Record<string, string> = {
  calza: 'bg-basilico-tenue text-basilico-scuro',
  vicina: 'bg-limone-tenue text-inchiostro',
  adattabile: 'bg-limone-tenue text-inchiostro',
}

function Barra({ nome, valore, obiettivo, colore }: { nome: string; valore: number; obiettivo: number; colore: string }) {
  const percentuale = obiettivo > 0 ? Math.min(100, Math.round((valore / obiettivo) * 100)) : 0
  const oltre = obiettivo > 0 && valore > obiettivo

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-inchiostro">{nome}</span>
        <span className={`cifre ${oltre ? 'text-pomodoro' : 'text-fumo'}`}>
          {Math.round(valore)} / {Math.round(obiettivo)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-fondo">
        <div
          className={`h-full rounded-full ${oltre ? 'bg-pomodoro' : colore}`}
          style={{ width: `${percentuale}%` }}
        />
      </div>
    </div>
  )
}

function SchedaPasto({
  pasto,
  ricetta,
  alternative,
  inOfferta,
}: {
  pasto: Pasto
  ricetta?: RicettaDelPasto
  alternative: AlternativeDiPasto
  inOfferta: Set<number>
}) {
  const nome = eFascia(pasto.fascia) ? NOME_FASCIA[pasto.fascia] : pasto.fascia
  const registrato = pasto.stato !== 'previsto'
  const kcalConsumate = pasto.consumati.reduce((t, c) => t + c.kcal, 0)

  const stile = stileFascia[pasto.fascia] ?? 'bg-basilico-tenue text-basilico-scuro'

  return (
    <article className={`scheda overflow-hidden ${registrato ? 'opacity-70' : ''}`}>
      {/* La foto sta sopra e sta grande: e' la ricetta, non una decorazione.
          Un pasto gia' registrato non la porta - li' il piatto e' fatto, e
          quello che serve e' il conto di cosa hai mangiato. */}
      {ricetta && !registrato ? (
        <Link href={`/cucina/${pasto.id}`} className="group block">
          <div className={`relative aspect-16/9 w-full overflow-hidden ${stile}`}>
            {ricetta.immagineUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- le foto arrivano da domini arbitrari
              <img
                src={ricetta.immagineUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              // Senza foto non si mette un rettangolo grigio con scritto
              // "senza foto": si mette il colore della fascia e il nome del
              // piatto, che e' comunque la cosa che stavi cercando.
              <div className="flex size-full items-center justify-center px-6">
                <span className="font-marchio text-center text-2xl leading-tight">
                  {ricetta.titolo}
                </span>
              </div>
            )}

            <span className={`pillola absolute top-3 left-3 shadow-appoggio ${stile}`}>{nome}</span>
          </div>
        </Link>
      ) : null}

      <div className="p-4">
        {!ricetta || registrato ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`pillola ${stile}`}>{nome}</span>
            {registrato ? (
              <span className="cifre text-sm font-bold text-inchiostro">
                {pasto.stato === 'saltato' ? 'saltato' : `${kcalConsumate} kcal`}
              </span>
            ) : null}
          </div>
        ) : null}

        {ricetta && !registrato ? (
          <Link href={`/cucina/${pasto.id}`} className="block">
            <h3 className="font-marchio text-xl leading-snug text-inchiostro">{ricetta.titolo}</h3>
            <p className="cifre mt-1 flex flex-wrap items-center gap-x-2 text-xs text-fumo">
              <span className={`pillola ${stileLivello[ricetta.livello]}`}>
                {NOME_LIVELLO[ricetta.livello]}
              </span>
              <span>{durata(ricetta.minuti)}</span>
              {ricetta.fonte ? <span>{ricetta.fonte.nome}</span> : null}
            </p>
          </Link>
        ) : null}

        {registrato ? (
          <ul className="mt-2 flex flex-col gap-1">
            {pasto.consumati.length === 0 ? (
              <li className="text-sm text-fumo">Niente.</li>
            ) : (
              pasto.consumati.map((c, i) => (
                <li key={i} className="cifre text-sm text-inchiostro">
                  {c.nome} · {c.quantita} {c.unita}
                </li>
              ))
            )}
          </ul>
        ) : (
          // Gli ingredienti servono qui, e servono a colpo d'occhio: cosa
          // mangi e quanto, senza aprire la ricetta. Erano pero' quattro
          // schede dentro una scheda, ognuna col suo fondo e la sua ombra, e
          // una lista di quattro cose diventava piu' alta della foto. Adesso
          // sono quattro righe separate da un filo.
          <ul className="divide-bordo mt-3 divide-y border-t border-bordo">
            {pasto.previsti.map((c, indice) => {
              const cambi = alternative.get(chiaveComponente(pasto.id, indice)) ?? []

              return (
                <li key={`${c.ruolo}-${c.nome}`} className="py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-inchiostro">
                      {c.nome}
                      {c.alimentoId !== null && inOfferta.has(c.alimentoId) ? (
                        <span className="pillola ml-2 bg-basilico-tenue text-basilico-scuro">
                          in offerta
                        </span>
                      ) : null}
                    </span>
                    <span className="cifre shrink-0 text-sm font-semibold text-inchiostro">
                      {c.quantita === 0 ? 'q.b.' : `${c.quantita} ${c.unita}`}
                    </span>
                  </div>

                  {cambi.length > 0 ? (
                    <details className="mt-0.5">
                      <summary className="cursor-pointer text-xs text-fumo">
                        Non ce l&rsquo;ho
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1">
                        {cambi.map((alternativa) => (
                          <li key={alternativa.id}>
                            <form action={sostituisciComponente} className="flex items-center gap-2">
                              <input type="hidden" name="pasto" value={pasto.id} />
                              <input type="hidden" name="indice" value={indice} />
                              <input type="hidden" name="alimento" value={alternativa.id} />
                              <input type="hidden" name="quantita" value={alternativa.quantita} />
                              <button
                                type="submit"
                                className="rounded-controllo flex w-full items-baseline justify-between gap-3 bg-bianco px-3 py-1.5 text-left hover:bg-basilico-tenue"
                              >
                                <span className="text-sm text-inchiostro">
                                  {alternativa.nome}
                                  {alternativa.fuoriLista ? (
                                    <span className="text-fumo"> · non in lista</span>
                                  ) : null}
                                </span>
                                <span className="cifre shrink-0 text-sm font-bold text-inchiostro">
                                  {alternativa.quantita} {alternativa.unita}
                                </span>
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-fumo">
                        Le quantità non sono le stesse: reggono lo stesso nutriente, non lo stesso
                        peso.
                      </p>
                    </details>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}


        {registrato ? (
          <form action={annullaRegistrazione} className="mt-3">
            <input type="hidden" name="pasto" value={pasto.id} />
            <button type="submit" className="pillola bg-fondo text-fumo">
              Annulla
            </button>
          </form>
        ) : (
          // Sei pulsanti tutti uguali che andavano a capo su tre righe, e
          // quello che si tocca ogni giorno - "l'ho mangiato" - stava in
          // mezzo agli altri. Adesso: uno che comanda, uno accanto, e gli
          // altri quattro sotto i puntini, dove si va quando serve.
          <div className="mt-4">
            <div className="flex items-stretch gap-2">
              <form action={spuntaPasto} className="flex-1">
                <input type="hidden" name="pasto" value={pasto.id} />
                <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
                  L&rsquo;ho mangiato
                </button>
              </form>

              {ricetta ? (
                <Link
                  href={`/cucina/${pasto.id}`}
                  className="bottone-chiaro flex items-center hover:bg-basilico hover:text-bianco"
                >
                  Cucina
                </Link>
              ) : null}

              <details className="group relative">
                <summary
                  aria-label="Altre opzioni"
                  className="bottone-chiaro flex h-full cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </summary>

                {/* Si apre sotto invece che sopra il contenuto: dentro una
                    scheda un menu che galleggia finisce tagliato, e su un
                    telefono non c'e' spazio per farlo galleggiare bene. */}
                <div className="rounded-scheda absolute right-0 z-10 mt-2 w-56 border border-bordo bg-bianco p-1 shadow-sollevata">
                  {ricetta && ricetta.alternative.length > 0 ? (
                    <form action={cambiaRicetta}>
                      <input type="hidden" name="pasto" value={pasto.id} />
                      <button type="submit" className="rounded-controllo w-full px-3 py-2 text-left text-sm text-inchiostro hover:bg-fondo">
                        Altra ricetta
                      </button>
                    </form>
                  ) : null}

                  <form action={cambiaPasto}>
                    <input type="hidden" name="pasto" value={pasto.id} />
                    <button type="submit" className="rounded-controllo w-full px-3 py-2 text-left text-sm text-inchiostro hover:bg-fondo">
                      Cambia gli alimenti
                    </button>
                  </form>

                  <form action={saltaPasto}>
                    <input type="hidden" name="pasto" value={pasto.id} />
                    <button type="submit" className="rounded-controllo w-full px-3 py-2 text-left text-sm text-inchiostro hover:bg-fondo">
                      Saltato
                    </button>
                  </form>
                </div>
              </details>
            </div>

            <details className="rounded-controllo mt-2 bg-fondo px-3 py-2">
              <summary className="cursor-pointer text-sm text-fumo">
                Ho mangiato fuori
              </summary>
              <form action={registraFuori} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="pasto" value={pasto.id} />
                <select
                  name="piatto"
                  id={`piatto-${pasto.id}`}
                  className="rounded-controllo flex-1 border border-bordo bg-bianco px-3 py-2 text-sm text-inchiostro outline-none focus:border-basilico"
                >
                  {GRUPPI_FUORI.map((gruppo) => (
                    <optgroup key={gruppo} label={gruppo}>
                      {PIATTI_FUORI.filter((p) => p.gruppo === gruppo).map((p) => (
                        <option key={p.nome} value={p.nome}>
                          {p.nome} · {p.kcal} kcal
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  type="number"
                  name="porzioni"
                  id={`porzioni-${pasto.id}`}
                  min={0.5}
                  max={4}
                  step={0.5}
                  defaultValue={1}
                  className="cifre w-16 rounded-controllo border border-bordo bg-bianco px-2 py-2 text-right text-sm text-inchiostro outline-none focus:border-basilico"
                />
                <button type="submit" className="bottone-chiaro">
                  Registra
                </button>
              </form>
              <p className="mt-2 text-xs text-fumo">
                Sono stime: una pizza cambia di duecento calorie fra un posto e l&rsquo;altro.
              </p>
            </details>
          </div>
        )}
      </div>
    </article>
  )
}

export default async function Oggi({
  searchParams,
}: {
  searchParams: Promise<{ giorno?: string }>
}) {
  // Il giorno guardato sta nell'indirizzo, cosi' e' un link che si condivide e
  // che il tasto indietro riporta indietro. Senza, e' oggi - ed e' giusto che
  // sia oggi: domani questa stessa pagina mostra domani da sola.
  const chiesto = (await searchParams).giorno
  const data = eData(chiesto) ? chiesto : oggi()
  const eOggi = data === oggi()

  let giorno = null
  let lista = null
  let giorniSettimana: Awaited<ReturnType<typeof settimana>> = []

  let ricette = new Map<number, RicettaDelPasto>()
  let alternative: AlternativeDiPasto = new Map()
  let inOfferta = new Set<number>()
  let scoperte: Scoperta[] = []

  const utente = await utenteCorrente()

  if (!utente) redirect('/entra')

  const utenteId = await utenteConProfilo()

  try {
    lista = await listaAttiva(utenteId)
    giorno = await leggiGiornata(utenteId, data)
    giorniSettimana = await settimana(utenteId, settimanaDi(data))

    if (giorno) {
      const previsti = giorno.pasti.filter((p) => p.stato === 'previsto')

      scoperte = await scopertePerUtente(utenteId)
      ricette = await ricetteDeiPasti(previsti)
      alternative = await alternativeDei(utenteId, previsti)

      const ids = previsti.flatMap((p) =>
        p.previsti.map((c) => c.alimentoId).filter((id): id is number => id !== null),
      )

      inOfferta = new Set(
        [...(await offertePerAlimenti(ids)).entries()]
          .filter(([, offerte]) => offerte.some((o) => o.certa))
          .map(([id]) => id),
      )
    }
  } catch (errore) {
    console.error('lettura della giornata fallita:', errore)

    return (
      <div className="min-h-dvh bg-fondo">
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
          <div className="scheda px-6 py-12 text-center">
            <h1 className="font-marchio text-2xl text-pomodoro">Il database non risponde</h1>
            <p className="mt-2 text-base text-fumo">Il dettaglio sta nei log del deploy.</p>
          </div>
        </main>
        <Navigazione attiva="oggi" />
      </div>
    )
  }

  const passato = quando(data, oggi()) === 'passato'

  const obiettivo = giorno?.giornata.obiettivo
  const consumato = giorno?.consumato
  const sforato = obiettivo && consumato ? Math.round(consumato.kcal - obiettivo.kcal) : 0

  return (
    <div className="min-h-dvh bg-fondo">
      <main className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
        {!lista ? (
          <div className="scheda mt-6 px-6 py-12 text-center">
            <h2 className="font-marchio text-2xl text-inchiostro">Prima gli ingredienti</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-fumo">
              Dimmi cosa puoi mangiare e da lì costruisco le giornate. Carichi il PDF del
              nutrizionista o te la componi da solo.
            </p>
            <Link href="/ingredienti" className="bottone mt-6 hover:bg-basilico-scuro">
              Vai agli ingredienti
            </Link>
          </div>
        ) : (
          <>
            <Calendario giorni={giorniSettimana} scelto={data} oggi={oggi()} />

            <form action={cambiaTipoGiorno} className="scheda mt-5 flex flex-wrap items-center gap-2 p-4">
              <input type="hidden" name="data" value={data} />
              {TIPI_GIORNO.map((tipo) => {
                const attivo = (giorno?.giornata.tipoGiorno ?? 'standard') === tipo

                return (
                  <button
                    key={tipo}
                    type="submit"
                    name="tipo"
                    value={tipo}
                    className={`pillola ${attivo ? 'bg-basilico text-bianco' : 'bg-fondo text-fumo'}`}
                  >
                    {NOME_TIPO_GIORNO[tipo as TipoGiorno]}
                  </button>
                )
              })}
            </form>

            {scoperte.length > 0 ? (
              <div className="rounded-scheda mt-5 bg-limone-tenue px-5 py-4">
                <p className="font-semibold text-inchiostro">Questo mese ti manca qualcosa</p>
                <p className="mt-1 text-sm text-inchiostro">
                  {scoperte
                    .map(
                      (s) =>
                        `${eFascia(s.fascia) ? NOME_FASCIA[s.fascia] : s.fascia} senza ${s.posto}`,
                    )
                    .filter((nome, i, tutti) => tutti.indexOf(nome) === i)
                    .join(', ')}
                  : quello che avevi spuntato lì adesso è fuori stagione, quindi l&rsquo;ho
                  lasciato fuori invece di proportelo a dispetto del calendario.{' '}
                  <Link
                    href="/ingredienti/gusti"
                    className="font-semibold underline underline-offset-4"
                  >
                    Spunta qualcosa di questo periodo
                  </Link>
                  .
                </p>
              </div>
            ) : null}

            {giorno && obiettivo && consumato ? (
              <div className="scheda mt-5 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-inchiostro">Come va la giornata</h2>
                  {sforato > 60 ? (
                    <span className="cifre pillola bg-pomodoro-tenue text-pomodoro">
                      sei a +{sforato} kcal
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <Barra nome="Calorie" valore={consumato.kcal} obiettivo={obiettivo.kcal} colore="bg-basilico" />
                  <Barra nome="Proteine" valore={consumato.proteine} obiettivo={obiettivo.proteine} colore="bg-basilico" />
                  <Barra nome="Carboidrati" valore={consumato.carboidrati} obiettivo={obiettivo.carboidrati} colore="bg-limone" />
                  <Barra nome="Grassi" valore={consumato.grassi} obiettivo={obiettivo.grassi} colore="bg-limone" />
                </div>

                {sforato > 60 ? (
                  <p className="mt-4 text-sm text-fumo">
                    Ho ridotto i pasti che restano dove potevo. Domani si riparte dall&rsquo;obiettivo
                    pieno: non si recupera.
                  </p>
                ) : null}
              </div>
            ) : null}

            {!giorno || giorno.pasti.length === 0 ? (
              passato ? (
                // Un giorno passato si guarda, non si compone: un menu per
                // martedi' scorso non vuol dire niente, e un pulsante che lo
                // offre e' un invito a sporcare lo storico.
                <div className="scheda mt-5 px-6 py-12 text-center">
                  <h2 className="font-marchio text-2xl text-inchiostro">Quel giorno non c&rsquo;era niente</h2>
                  <p className="mx-auto mt-2 max-w-md text-base text-fumo">
                    Non hai preparato la giornata e non hai registrato nulla.
                  </p>
                </div>
              ) : (
                <form action={generaGiorno} className="scheda mt-5 px-6 py-12 text-center">
                  <input type="hidden" name="data" value={data} />
                  <h2 className="font-marchio text-2xl text-inchiostro">
                    {eOggi ? 'Non c’è ancora la giornata' : 'Questo giorno è da preparare'}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-base text-fumo">
                    Compongo i pasti dai tuoi ingredienti, con i grammi giusti.
                  </p>
                  <button type="submit" className="bottone mt-6 hover:bg-basilico-scuro">
                    Prepara la giornata
                  </button>
                </form>
              )
            ) : (
              <>
                <div className="mt-6 flex flex-col gap-4">
                  {giorno.pasti.map((pasto) => (
                    <SchedaPasto
                      key={pasto.id}
                      pasto={pasto}
                      ricetta={ricette.get(pasto.id)}
                      alternative={alternative}
                      inOfferta={inOfferta}
                    />
                  ))}
                </div>

                {passato ? null : (
                  <form action={generaGiorno} className="mt-6">
                    <input type="hidden" name="data" value={data} />
                    <button type="submit" className="bottone-chiaro w-full hover:bg-basilico hover:text-bianco">
                      Rifai la giornata
                    </button>
                  </form>
                )}
              </>
            )}
          </>
        )}
      </main>
      <Navigazione attiva="oggi" />
    </div>
  )
}
