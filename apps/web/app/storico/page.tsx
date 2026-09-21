import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'

import { db, pesi } from '@prontooo/db'

import { utenteConProfilo } from '@/lib/accesso/sessione'
import { resoconto } from '@/lib/giornata/storico'
import { NOME_FASCIA, eFascia } from '@/lib/ricette/fasce'
import { NOME_TIPO_GIORNO, type TipoGiorno } from '@/lib/giornata/modello'

import { Promemoria } from '../componenti/promemoria'
import { Navigazione } from '../componenti/navigazione'

import { segnaPeso, togliPeso } from './azioni'

export const dynamic = 'force-dynamic'

const giornoBreve = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

function etichetta(data: string): string {
  const [a, m, g] = data.split('-').map(Number)

  return giornoBreve.format(new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, g ?? 1)))
}

const stileStato: Record<string, string> = {
  mangiato: 'bg-basilico-tenue text-basilico-scuro',
  saltato: 'bg-pomodoro-tenue text-pomodoro',
  fuori_piano: 'bg-limone-tenue text-inchiostro',
  previsto: 'bg-fondo text-fumo',
}

const nomeStato: Record<string, string> = {
  mangiato: 'mangiato',
  saltato: 'saltato',
  fuori_piano: 'fuori',
  previsto: 'non registrato',
}

export default async function Storico() {
  let dati: Awaited<ReturnType<typeof resoconto>> | null = null
  let misure: { id: number; data: string; kg: string }[] = []

  const utenteId = await utenteConProfilo()

  try {
    dati = await resoconto(utenteId, 30)
    misure = await db()
      .select()
      .from(pesi)
      .where(eq(pesi.utenteId, utenteId))
      .orderBy(desc(pesi.data))
      .limit(12)
  } catch (errore) {
    console.error('lettura dello storico fallita:', errore)
  }

  const oggi = new Date().toISOString().slice(0, 10)
  const ultimo = misure[0]
  const precedente = misure[1]
  const scarto = ultimo && precedente ? Number(ultimo.kg) - Number(precedente.kg) : null

  return (
    <div className="min-h-dvh bg-fondo">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">Storico</h1>
        <p className="mt-1 max-w-xl text-fumo">
          Cosa hai fatto davvero negli ultimi trenta giorni, non cosa avevi in programma.
        </p>

        <Promemoria chiavePubblica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />

        <Link href="/resoconto" className="bottone-chiaro mt-4 inline-block hover:bg-basilico hover:text-bianco">
          Il resoconto per la visita
        </Link>

        {!dati || dati.giorniSeguiti === 0 ? (
          <div className="scheda mt-6 px-6 py-12 text-center">
            <h2 className="font-marchio text-2xl text-inchiostro">Ancora niente da mostrare</h2>
            <p className="mx-auto mt-2 max-w-md text-fumo">
              Lo storico si riempie da solo man mano che spunti i pasti. Bastano pochi giorni
              perché cominci a dire qualcosa.
            </p>
          </div>
        ) : (
          <>
            <section className="scheda mt-6 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-marchio text-xl text-inchiostro">Come è andata</h2>
                <span className="cifre text-sm text-fumo">
                  {dati.giorniSeguiti} giorni registrati
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-controllo bg-fondo px-4 py-3">
                  <p className="cifre text-2xl font-bold text-inchiostro">{dati.aderenza}%</p>
                  <p className="text-sm text-fumo">pasti seguiti</p>
                </div>
                <div className="rounded-controllo bg-fondo px-4 py-3">
                  <p className="cifre text-2xl font-bold text-inchiostro">{dati.mediaKcal}</p>
                  <p className="text-sm text-fumo">kcal al giorno, in media</p>
                </div>
              </div>

              <ul className="mt-4 flex flex-col gap-1.5">
                {dati.perFascia.map((r) => (
                  <li
                    key={r.fascia}
                    className="rounded-controllo flex flex-wrap items-center gap-3 bg-fondo px-3 py-2"
                  >
                    <span className="min-w-24 text-inchiostro">
                      {eFascia(r.fascia) ? NOME_FASCIA[r.fascia] : r.fascia}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-bianco">
                      <span
                        className="block h-full rounded-full bg-basilico"
                        style={{ width: `${r.aderenza}%` }}
                      />
                    </span>
                    <span className="cifre shrink-0 text-sm text-fumo">
                      {r.aderenza}% · {r.saltati} saltati · {r.fuori} fuori
                    </span>
                  </li>
                ))}
              </ul>

              {dati.puntoDebole ? (
                <p className="rounded-controllo mt-4 bg-limone-tenue px-4 py-3 text-sm text-inchiostro">
                  Dove caschi più spesso:{' '}
                  <span className="font-semibold">
                    {eFascia(dati.puntoDebole) ? NOME_FASCIA[dati.puntoDebole] : dati.puntoDebole}
                  </span>
                  . Non è una colpa, è un&rsquo;informazione: se succede sempre, il piano lì è
                  sbagliato.
                </p>
              ) : null}
            </section>

            <section className="scheda mt-5 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-marchio text-xl text-inchiostro">Il peso</h2>
                {ultimo ? (
                  <span className="cifre text-sm text-fumo">
                    {Number(ultimo.kg).toFixed(1)} kg
                    {scarto !== null && Math.abs(scarto) >= 0.1
                      ? ` · ${scarto > 0 ? '+' : ''}${scarto.toFixed(1)} dal precedente`
                      : ''}
                  </span>
                ) : null}
              </div>

              <form action={segnaPeso} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-inchiostro">Quanto pesi</span>
                  <input
                    type="text"
                    name="kg"
                    inputMode="decimal"
                    placeholder="78,4"
                    required
                    className="cifre w-28 rounded-controllo border border-bordo bg-bianco px-3 py-2 text-inchiostro outline-none focus:border-basilico"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-inchiostro">Quando</span>
                  <input
                    type="date"
                    name="data"
                    defaultValue={oggi}
                    className="cifre rounded-controllo border border-bordo bg-bianco px-3 py-2 text-inchiostro outline-none focus:border-basilico"
                  />
                </label>
                <button type="submit" className="bottone hover:bg-basilico-scuro">
                  Segna
                </button>
              </form>

              {misure.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {misure.map((m) => (
                    <li key={m.id}>
                      <form action={togliPeso}>
                        <input type="hidden" name="peso" value={m.id} />
                        <button
                          type="submit"
                          className="pillola cifre bg-fondo text-fumo hover:bg-pomodoro-tenue hover:text-pomodoro"
                          title="Togli"
                        >
                          {etichetta(m.data)} · {Number(m.kg).toFixed(1)} kg
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-fumo">
                  Il peso serve solo se lo vuoi: senza, il resto dello storico funziona uguale.
                </p>
              )}
            </section>

            <section className="mt-8">
              <h2 className="font-marchio text-2xl text-inchiostro">Giorno per giorno</h2>

              <ul className="mt-4 flex flex-col gap-2">
                {dati.giorni.map((g) => (
                  <li key={g.data} className="scheda p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-inchiostro first-letter:uppercase">
                        {etichetta(g.data)}
                      </span>
                      <span className="cifre text-sm text-fumo">
                        {NOME_TIPO_GIORNO[g.tipoGiorno as TipoGiorno] ?? g.tipoGiorno}
                        {g.consumato.kcal > 0
                          ? ` · ${Math.round(g.consumato.kcal)}${g.obiettivo ? ` / ${Math.round(g.obiettivo.kcal)}` : ''} kcal`
                          : ''}
                      </span>
                    </div>

                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {g.pasti.map((p, i) => (
                        <li key={i} className={`pillola ${stileStato[p.stato] ?? 'bg-fondo text-fumo'}`}>
                          {eFascia(p.fascia) ? NOME_FASCIA[p.fascia] : p.fascia}
                          <span className="opacity-70"> · {nomeStato[p.stato] ?? p.stato}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
      <Navigazione attiva="storico" />
    </div>
  )
}
