import Link from 'next/link'

import { utenteConProfilo } from '@/lib/accesso/sessione'
import { lunediDi } from '@/lib/spesa/calcola'
import { type ConsiglioSpesa, spesaConOfferte } from '@/lib/spesa/offerte'

import { Testata } from '../componenti/testata'

import { aggiungiInDispensa, preparaSettimana, spunta } from './azioni'

export const dynamic = 'force-dynamic'

const dataBreve = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

function etichetta(data: string, piu = 0): string {
  const [a, m, g] = data.split('-').map(Number)

  return dataBreve.format(new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, (g ?? 1) + piu)))
}

export default async function Spesa() {
  const settimana = lunediDi()
  const vuota: ConsiglioSpesa = {
    gruppi: [],
    tappe: [],
    guadagnoSeconda: 0,
    soloNellaSeconda: 0,
    valeDueTappe: false,
  }

  let consiglio = vuota

  try {
    consiglio = await spesaConOfferte(await utenteConProfilo(), settimana)
  } catch (errore) {
    console.error('calcolo della lista fallito:', errore)
  }

  const { gruppi, tappe } = consiglio
  const totale = gruppi.reduce((t, g) => t + g.voci.length, 0)
  const presi = gruppi.reduce((t, g) => t + g.voci.filter((v) => v.spuntato).length, 0)

  return (
    <div className="min-h-dvh bg-fondo">
      <Testata attiva="spesa" />

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">La spesa</h1>
        <p className="cifre mt-1 text-sm text-fumo">
          dal {etichetta(settimana)} al {etichetta(settimana, 6)}
          {totale > 0 ? ` · ${presi} su ${totale} presi` : ''}
        </p>

        {totale === 0 ? (
          <form action={preparaSettimana} className="scheda mt-6 px-6 py-12 text-center">
            <input type="hidden" name="settimana" value={settimana} />
            <h2 className="font-marchio text-2xl text-inchiostro">Niente da comprare</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-fumo">
              La lista nasce dai pasti della settimana. Preparo i sette giorni e la lista esce da
              sola: cambi un pasto e cambia anche lei.
            </p>
            <button type="submit" className="bottone mt-6 hover:bg-basilico-scuro">
              Prepara la settimana
            </button>
            <p className="mt-4 text-sm text-fumo">
              Se non hai ancora la lista degli ingredienti,{' '}
              <Link href="/ingredienti" className="font-semibold text-basilico-scuro underline underline-offset-4">
                si comincia da lì
              </Link>
              .
            </p>
          </form>
        ) : (
          <>
            {tappe.length > 0 ? (
              <section className="scheda mt-6 p-5">
                <h2 className="font-marchio text-xl text-inchiostro">Dove conviene</h2>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {tappe.map((t) => (
                    <li
                      key={`${t.insegna}-${t.puntoVendita ?? ''}`}
                      className="rounded-controllo flex flex-wrap items-baseline justify-between gap-2 bg-fondo px-3 py-2"
                    >
                      <span className="text-inchiostro">
                        {t.insegna}
                        {t.puntoVendita ? <span className="text-fumo"> · {t.puntoVendita}</span> : null}
                      </span>
                      <span className="cifre text-sm text-fumo">
                        {t.quante} cose · {t.spesa.toFixed(2)} €
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-sm text-fumo">
                  {tappe.length < 2
                    ? 'Una tappa sola: tutto quello che è in offerta sta qui.'
                    : consiglio.valeDueTappe
                      ? `La seconda tappa vale la pena: risparmi ${consiglio.guadagnoSeconda.toFixed(2)} € e ci trovi altre ${consiglio.soloNellaSeconda} cose.`
                      : 'Fermati alla prima. La seconda tappa non recupera il tempo che costa.'}
                </p>
              </section>
            ) : null}

            <div className="mt-6 flex flex-col gap-5">
              {gruppi.map((gruppo) => (
                <section key={gruppo.reparto} className="scheda p-5">
                  <h2 className="font-marchio text-xl text-inchiostro">{gruppo.nome}</h2>

                  <div className="mt-3 flex flex-col gap-1.5">
                    {gruppo.voci.map((voce) => (
                      <div
                        key={voce.alimentoId}
                        className={`rounded-controllo flex flex-wrap items-center gap-2 px-3 py-2 ${
                          voce.spuntato ? 'bg-basilico-tenue' : 'bg-fondo'
                        }`}
                      >
                        <form action={spunta} className="flex min-w-0 flex-1 items-center gap-3">
                          <input type="hidden" name="alimento" value={voce.alimentoId} />
                          <input type="hidden" name="settimana" value={settimana} />
                          <input type="hidden" name="spuntato" value={voce.spuntato ? 'si' : 'no'} />
                          <button
                            type="submit"
                            className={`size-5 shrink-0 rounded-full border-2 ${
                              voce.spuntato ? 'border-basilico bg-basilico' : 'border-bordo bg-bianco'
                            }`}
                            aria-label={voce.spuntato ? 'Togli dal carrello' : 'Metti nel carrello'}
                          />
                          <span
                            className={`min-w-0 flex-1 text-left text-base ${
                              voce.spuntato ? 'text-fumo line-through' : 'text-inchiostro'
                            }`}
                          >
                            {voce.nome}
                            {voce.inDispensa > 0 ? (
                              <span className="cifre ml-2 text-xs text-fumo">
                                hai già {voce.inDispensa} {voce.unita}
                              </span>
                            ) : null}
                          </span>
                        </form>

                        <span className="cifre shrink-0 text-base font-bold text-inchiostro">
                          {voce.daComprare} {voce.unita}
                        </span>

                        {voce.migliore ? (
                          <span className="cifre pillola shrink-0 bg-basilico-tenue text-basilico-scuro">
                            {voce.migliore.insegna} {voce.migliore.prezzo.toFixed(2)} €
                          </span>
                        ) : voce.offerte.length > 0 ? (
                          <span className="cifre pillola shrink-0 bg-limone-tenue text-inchiostro">
                            {voce.offerte[0]!.insegna} {voce.offerte[0]!.prezzo.toFixed(2)} € · da
                            verificare
                          </span>
                        ) : null}

                        <form action={aggiungiInDispensa} className="flex items-center gap-1">
                          <input type="hidden" name="alimento" value={voce.alimentoId} />
                          <input
                            type="number"
                            name="quantita"
                            id={`disp-${voce.alimentoId}`}
                            min={0}
                            step={10}
                            defaultValue={voce.inDispensa}
                            className="cifre w-16 rounded-controllo border border-bordo bg-bianco px-2 py-1 text-right text-xs text-inchiostro outline-none focus:border-basilico"
                            aria-label="Quanto ne hai in dispensa"
                          />
                          <button type="submit" className="pillola bg-bianco text-fumo">
                            In casa
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <form action={preparaSettimana} className="mt-6">
              <input type="hidden" name="settimana" value={settimana} />
              <button type="submit" className="bottone-chiaro w-full hover:bg-basilico hover:text-bianco">
                Ricalcola la settimana
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
