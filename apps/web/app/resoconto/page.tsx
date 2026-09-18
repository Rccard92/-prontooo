import Link from 'next/link'
import { and, desc, eq, gte } from 'drizzle-orm'

import { db, pesi } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { resoconto } from '@/lib/giornata/storico'
import { NOME_FASCIA, eFascia } from '@/lib/ricette/fasce'

import { Stampa } from './stampa'

export const dynamic = 'force-dynamic'

const giornoBreve = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const giornoLungo = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function data(valore: string, lungo = false): string {
  const [a, m, g] = valore.split('-').map(Number)
  const d = new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, g ?? 1))

  return (lungo ? giornoLungo : giornoBreve).format(d)
}

function nomeFascia(fascia: string): string {
  return eFascia(fascia) ? NOME_FASCIA[fascia] : fascia
}

const PERIODI = [30, 60, 90] as const

export default async function Resoconto({
  searchParams,
}: {
  searchParams: Promise<{ giorni?: string }>
}) {
  const chiesto = Number((await searchParams).giorni)
  const giorni = PERIODI.includes(chiesto as (typeof PERIODI)[number]) ? chiesto : 30

  let dati: Awaited<ReturnType<typeof resoconto>> | null = null
  let misure: { data: string; kg: string }[] = []

  const da = new Date(Date.now() - giorni * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const utenteId = await utenteObbligatorio()

  try {
    dati = await resoconto(utenteId, giorni)
    misure = await db()
      .select({ data: pesi.data, kg: pesi.kg })
      .from(pesi)
      .where(and(eq(pesi.utenteId, utenteId), gte(pesi.data, da)))
      .orderBy(desc(pesi.data))
  } catch (errore) {
    console.error('resoconto non calcolato:', errore)
  }

  const primo = misure[misure.length - 1]
  const ultimo = misure[0]
  const variazione = primo && ultimo ? Number(ultimo.kg) - Number(primo.kg) : null

  return (
    <div className="min-h-dvh bg-fondo print:bg-bianco">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/storico" className="text-sm font-semibold text-fumo hover:text-basilico">
            Torna allo storico
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {PERIODI.map((p) => (
              <Link
                key={p}
                href={`/resoconto?giorni=${p}`}
                className={`pillola cifre ${p === giorni ? 'bg-basilico text-bianco' : 'bg-bianco text-fumo'}`}
              >
                {p} giorni
              </Link>
            ))}
            <Stampa />
          </div>
        </div>

        <article className="scheda mt-5 p-6 sm:p-8 print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b border-bordo pb-4">
            <h1 className="font-marchio text-3xl text-inchiostro">Resoconto alimentare</h1>
            <p className="cifre mt-1 text-fumo">
              dal {data(da, true)} a oggi · {giorni} giorni
            </p>
            <p className="mt-2 max-w-2xl text-sm text-fumo">
              I valori nutrizionali vengono dalle tabelle CREA e sono indicativi: stimano una
              giornata, non la certificano. Quello che è preciso è cosa è stato registrato e cosa
              no.
            </p>
          </header>

          {!dati || dati.giorniSeguiti === 0 ? (
            <p className="mt-6 text-fumo">
              Nel periodo non ci sono giorni registrati, quindi non c&rsquo;è niente da riferire.
            </p>
          ) : (
            <>
              <section className="mt-6">
                <h2 className="font-marchio text-xl text-inchiostro">In due numeri</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { nome: 'Giorni registrati', valore: String(dati.giorniSeguiti) },
                    { nome: 'Pasti seguiti', valore: `${dati.aderenza}%` },
                    { nome: 'Calorie al giorno', valore: String(dati.mediaKcal) },
                    { nome: 'Proteine al giorno', valore: `${dati.mediaProteine} g` },
                  ].map((v) => (
                    <div key={v.nome} className="rounded-controllo bg-fondo px-4 py-3 print:border print:border-bordo">
                      <p className="cifre text-2xl font-bold text-inchiostro">{v.valore}</p>
                      <p className="text-sm text-fumo">{v.nome}</p>
                    </div>
                  ))}
                </div>
                <p className="cifre mt-2 text-sm text-fumo">
                  Carboidrati {dati.mediaCarboidrati} g · grassi {dati.mediaGrassi} g, in media al
                  giorno.
                </p>
              </section>

              <section className="mt-7 break-inside-avoid">
                <h2 className="font-marchio text-xl text-inchiostro">Fascia per fascia</h2>
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-bordo text-left text-fumo">
                      <th className="py-2 font-semibold">Pasto</th>
                      <th className="py-2 text-right font-semibold">Seguito</th>
                      <th className="py-2 text-right font-semibold">Saltato</th>
                      <th className="py-2 text-right font-semibold">Fuori</th>
                      <th className="py-2 text-right font-semibold">Non registrato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dati.perFascia.map((r) => (
                      <tr key={r.fascia} className="border-b border-bordo">
                        <td className="py-2 text-inchiostro">{nomeFascia(r.fascia)}</td>
                        <td className="cifre py-2 text-right font-bold text-inchiostro">
                          {r.aderenza}%
                        </td>
                        <td className="cifre py-2 text-right text-fumo">{r.saltati}</td>
                        <td className="cifre py-2 text-right text-fumo">{r.fuori}</td>
                        <td className="cifre py-2 text-right text-fumo">{r.nonRegistrati}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {dati.puntoDebole ? (
                  <p className="mt-3 text-sm text-inchiostro">
                    Il punto debole è <strong>{nomeFascia(dati.puntoDebole)}</strong>: sta sotto le
                    altre fasce in modo costante, non per un caso isolato.
                  </p>
                ) : null}
              </section>

              {dati.settimane.length > 1 ? (
                <section className="mt-7 break-inside-avoid">
                  <h2 className="font-marchio text-xl text-inchiostro">Settimana per settimana</h2>
                  <table className="mt-3 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-bordo text-left text-fumo">
                        <th className="py-2 font-semibold">Dal</th>
                        <th className="py-2 text-right font-semibold">Giorni</th>
                        <th className="py-2 text-right font-semibold">Seguito</th>
                        <th className="py-2 text-right font-semibold">Kcal al giorno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dati.settimane.map((s) => (
                        <tr key={s.inizio} className="border-b border-bordo">
                          <td className="cifre py-2 text-inchiostro">{data(s.inizio)}</td>
                          <td className="cifre py-2 text-right text-fumo">{s.giorni}</td>
                          <td className="cifre py-2 text-right font-bold text-inchiostro">
                            {s.aderenza}%
                          </td>
                          <td className="cifre py-2 text-right text-fumo">{s.mediaKcal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : null}

              {dati.fuoriPiano.length > 0 ? (
                <section className="mt-7 break-inside-avoid">
                  <h2 className="font-marchio text-xl text-inchiostro">Al posto di cosa</h2>
                  <p className="mt-1 text-sm text-fumo">
                    Un pasto saltato una volta è la vita. Lo stesso pasto sostituito dalla stessa
                    cosa per settimane è il piano che non va bene lì.
                  </p>
                  <table className="mt-3 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-bordo text-left text-fumo">
                        <th className="py-2 font-semibold">Pasto</th>
                        <th className="py-2 font-semibold">Era previsto</th>
                        <th className="py-2 font-semibold">Ha mangiato</th>
                        <th className="py-2 text-right font-semibold">Volte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dati.fuoriPiano.map((f, i) => (
                        <tr key={i} className="border-b border-bordo">
                          <td className="py-2 text-inchiostro">{nomeFascia(f.fascia)}</td>
                          <td className="py-2 text-fumo">{f.previsto}</td>
                          <td className="py-2 text-inchiostro">{f.mangiato}</td>
                          <td className="cifre py-2 text-right font-bold text-inchiostro">
                            {f.quante}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : null}

              {misure.length > 0 ? (
                <section className="mt-7 break-inside-avoid">
                  <h2 className="font-marchio text-xl text-inchiostro">Il peso</h2>
                  <p className="cifre mt-2 text-inchiostro">
                    Da {Number(primo!.kg).toFixed(1)} kg a {Number(ultimo!.kg).toFixed(1)} kg
                    {variazione !== null
                      ? ` · ${variazione > 0 ? '+' : ''}${variazione.toFixed(1)} kg in ${misure.length} misurazioni`
                      : ''}
                  </p>
                  <ul className="cifre mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fumo">
                    {misure.map((m) => (
                      <li key={m.data}>
                        {data(m.data)} · {Number(m.kg).toFixed(1)} kg
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}

          <footer className="mt-8 border-t border-bordo pt-4 text-xs text-fumo">
            Generato da èProntooo. I pasti non registrati non sono pasti saltati: sono pasti di cui
            non si sa niente, e nel conto dell&rsquo;aderenza pesano come non seguiti.
          </footer>
        </article>
      </main>
    </div>
  )
}
