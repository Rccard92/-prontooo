import { INSEGNE, daVerificare, volantiniCaricati } from '@/lib/offerte/archivio'

import { Navigazione } from '../componenti/navigazione'

import { cancellaVolantino, caricaVolantino, confermaAggancio, scollegaOfferta } from './azioni'

export const dynamic = 'force-dynamic'

const giorno = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' })

function data(valore: string | null): string | null {
  if (!valore) return null

  const [a, m, g] = valore.split('-').map(Number)

  return giorno.format(new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, g ?? 1)))
}

export default async function Offerte() {
  let volantini: Awaited<ReturnType<typeof volantiniCaricati>> = []
  let incerte: Awaited<ReturnType<typeof daVerificare>> = []

  try {
    volantini = await volantiniCaricati()
    incerte = await daVerificare()
  } catch (errore) {
    console.error('lettura dei volantini fallita:', errore)
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">Offerte</h1>
        <p className="mt-1 max-w-2xl text-fumo">
          I volantini li scarico da solo, una volta a settimana, e quello che riconosco finisce
          accanto alla spesa. Qui sotto vedi cosa ho trovato e correggi gli agganci che non mi
          convincono.
        </p>

        <details className="scheda mt-6 p-5">
          <summary className="cursor-pointer font-semibold text-inchiostro">
            Caricarne uno a mano
          </summary>
          <p className="mt-2 text-sm text-fumo">
            Serve quando un&rsquo;insegna non si lascia scaricare, o per il tuo Conad: e&rsquo; una
            cooperativa, il volantino cambia per negozio, e l&rsquo;unico modo di avere i prezzi
            veri è puntare al tuo punto vendita.
          </p>

          <form action={caricaVolantino} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-inchiostro">Insegna</span>
              <select
                name="insegna"
                className="rounded-controllo border border-bordo bg-bianco px-3 py-2 text-inchiostro outline-none focus:border-basilico"
              >
                {INSEGNE.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-inchiostro">Punto vendita</span>
              <input
                type="text"
                name="puntoVendita"
                placeholder="Via Roma, Palermo"
                className="rounded-controllo border border-bordo bg-bianco px-3 py-2 text-inchiostro outline-none focus:border-basilico"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-inchiostro">Valido dal</span>
              <input
                type="date"
                name="validoDal"
                className="cifre rounded-controllo border border-bordo bg-bianco px-3 py-2 text-inchiostro outline-none focus:border-basilico"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-inchiostro">Valido fino al</span>
              <input
                type="date"
                name="validoAl"
                className="cifre rounded-controllo border border-bordo bg-bianco px-3 py-2 text-inchiostro outline-none focus:border-basilico"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-inchiostro">Il PDF del volantino</span>
            <input
              type="file"
              name="volantino"
              accept="application/pdf"
              required
              className="rounded-controllo border border-bordo bg-bianco px-3 py-2 text-sm text-fumo file:mr-3 file:rounded-full file:border-0 file:bg-basilico-tenue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-basilico-scuro"
            />
          </label>

          <button type="submit" className="bottone self-start hover:bg-basilico-scuro">
            Carica il volantino
          </button>

          </form>
        </details>

        {incerte.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-marchio text-2xl text-inchiostro">Da verificare</h2>
            <p className="mt-1 text-fumo">
              Queste le ho agganciate, ma non ci metto la mano sul fuoco. Finché non confermi
              restano marcate.
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {incerte.map((o) => (
                <li key={o.id} className="scheda flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-inchiostro">{o.nomeGrezzo}</p>
                    <p className="cifre mt-0.5 text-sm text-fumo">
                      {o.insegna} · {Number(o.prezzo).toFixed(2)} €
                      {o.formato ? ` · ${o.formato}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-inchiostro">
                      Dovrebbe essere{' '}
                      <span className="font-semibold">{o.alimentoNome ?? 'niente'}</span>
                      <span className="cifre text-fumo">
                        {' '}
                        · {Math.round(Number(o.confidenza) * 100)}%
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <form action={confermaAggancio}>
                      <input type="hidden" name="offerta" value={o.id} />
                      <button type="submit" className="bottone-chiaro hover:bg-basilico hover:text-bianco">
                        È giusto
                      </button>
                    </form>
                    <form action={scollegaOfferta}>
                      <input type="hidden" name="offerta" value={o.id} />
                      <button type="submit" className="pillola bg-fondo text-fumo">
                        Non c&rsquo;entra
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="font-marchio text-2xl text-inchiostro">I volantini caricati</h2>

          {volantini.length === 0 ? (
            <p className="mt-2 text-fumo">Nessuno, per ora. Il primo lo carichi qui sopra.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {volantini.map((v) => (
                <li key={v.id} className="scheda flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-inchiostro">
                      {v.insegna}
                      {v.puntoVendita ? <span className="text-fumo"> · {v.puntoVendita}</span> : null}
                    </p>
                    <p className="cifre mt-0.5 text-sm text-fumo">
                      {v.agganciate} offerte riconosciute su {v.quante}
                      {v.validoAl ? ` · fino al ${data(v.validoAl)}` : ''}
                    </p>
                  </div>

                  <form action={cancellaVolantino}>
                    <input type="hidden" name="volantino" value={v.id} />
                    <button type="submit" className="pillola bg-fondo text-fumo">
                      Togli
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Navigazione attiva="offerte" />
    </div>
  )
}
