import Link from 'next/link'
import { asc } from 'drizzle-orm'

import { alimenti as tabellaAlimenti, db } from '@prontooo/db'
import { NOME_FASCIA as NOMI, FASCE } from '@/lib/ricette/fasce'
import { utenteConProfilo } from '@/lib/accesso/sessione'
import { listaAttiva, righePerFascia, tutteLeListe, vociDi } from '@/lib/lista/archivio'
import { arrotonda, nutrientiDi, obiettivoDa, sommaNutrienti } from '@/lib/lista/modello'

import { Navigazione } from '../componenti/navigazione'

import {
  aggiungiVoce,
  cambiaQuantita,
  collegaAlimento,
  eliminaLista,
  leggiPdf,
  rendiAttiva,
  togliVoce,
} from './azioni'

export const dynamic = 'force-dynamic'

const campo =
  'rounded-controllo border border-bordo bg-fondo px-3 py-2 text-base text-inchiostro outline-none focus:border-basilico'

function Vuoto() {
  return (
    <div className="scheda p-6 sm:p-10">
      <h2 className="font-marchio text-2xl text-inchiostro">Da dove partiamo</h2>
      <p className="mt-2 max-w-xl text-base text-fumo">
        Qui dentro sta l&rsquo;elenco di cosa puoi mangiare, per pasto, con i grammi. È da questo
        che nascono le ricette del giorno e la lista della spesa. Due strade, stesso risultato.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <form action={leggiPdf} className="rounded-controllo bg-fondo p-5">
          <h3 className="text-base font-bold text-inchiostro">Ho la dieta del nutrizionista</h3>
          <p className="mt-1 text-sm text-fumo">
            Carica il PDF. Leggo alimenti, quantità e pasti, e ti dico cosa ho capito prima di
            tenerlo.
          </p>
          <input
            type="file"
            name="pdf"
            id="pdf"
            accept="application/pdf"
            required
            className="mt-4 block w-full text-sm text-fumo file:mr-3 file:rounded-full file:border-0 file:bg-basilico-tenue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-basilico-scuro"
          />
          <button type="submit" className="bottone mt-4 w-full hover:bg-basilico-scuro">
            Leggi il PDF
          </button>
        </form>

        <div className="rounded-controllo bg-fondo p-5">
          <h3 className="text-base font-bold text-inchiostro">Me la faccio da solo</h3>
          <p className="mt-1 text-sm text-fumo">
            Spunti quello che ti piace, diviso per categoria, e i pasti li costruisco io: ogni
            alimento finisce solo nei pasti dove ha senso. Nessun nutrizionista richiesto.
          </p>
          <Link
            href="/ingredienti/gusti"
            className="bottone-chiaro mt-4 block w-full text-center hover:bg-basilico hover:text-bianco"
          >
            Scegli cosa ti piace
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function Ingredienti({
  searchParams,
}: {
  searchParams: Promise<{
    errore?: string
    importate?: string
    dacollegare?: string
    salvati?: string
  }>
}) {
  const { errore, importate, dacollegare, salvati } = await searchParams
  const utenteId = await utenteConProfilo()
  const lista = await listaAttiva(utenteId)
  const liste = await tutteLeListe(utenteId)
  const voci = lista ? await vociDi(utenteId, lista.id) : []
  const vocabolario = await db()
    .select({ id: tabellaAlimenti.id, nome: tabellaAlimenti.nome, fasce: tabellaAlimenti.fasce })
    .from(tabellaAlimenti)
    .orderBy(asc(tabellaAlimenti.nome))

  const daCollegare = voci.filter((v) => v.alimentoId === null)

  const totaleGiorno = arrotonda(
    sommaNutrienti(FASCE.map((f) => obiettivoDa(righePerFascia(voci, f)))),
  )

  return (
    <div className="min-h-dvh bg-fondo">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">I miei ingredienti</h1>

        {errore ? (
          <p className="rounded-controllo bg-pomodoro-tenue mt-5 px-4 py-3 text-sm text-pomodoro">
            {errore}
          </p>
        ) : null}

        {salvati ? (
          <p className="rounded-controllo mt-5 bg-basilico-tenue px-4 py-3 text-sm text-basilico-scuro">
            Salvati {salvati} alimenti, e i pasti sono costruiti. Da qui puoi correggere i grammi.
          </p>
        ) : null}

        {importate ? (
          <p className="rounded-controllo bg-basilico-tenue mt-5 px-4 py-3 text-sm text-basilico-scuro">
            Letto: {importate} voci.{' '}
            {Number(dacollegare) > 0
              ? `${dacollegare} non le ho riconosciute e te le ho segnate in rosso: collegale una volta sola.`
              : 'Le ho riconosciute tutte.'}
          </p>
        ) : null}

        {!lista ? (
          <div className="mt-6">
            <Vuoto />
          </div>
        ) : (
          <>
            <div className="scheda mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-base font-bold text-inchiostro">{lista.nome}</p>
                <p className="cifre text-sm text-fumo">
                  {voci.length} voci · circa {totaleGiorno.kcal} kcal al giorno · {totaleGiorno.proteine}g
                  proteine
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/ingredienti/gusti"
                  className="bottone-chiaro hover:bg-basilico hover:text-bianco"
                >
                  Cambia i gusti
                </Link>
              </div>
              <form action={leggiPdf} className="flex items-center gap-2">
                <input
                  type="file"
                  name="pdf"
                  id="pdf-nuovo"
                  accept="application/pdf"
                  required
                  className="block w-40 text-xs text-fumo file:mr-2 file:rounded-full file:border-0 file:bg-basilico-tenue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-basilico-scuro"
                />
                <button type="submit" className="bottone-chiaro hover:bg-basilico hover:text-bianco">
                  Carica dieta nuova
                </button>
              </form>
            </div>

            {daCollegare.length > 0 ? (
              <div className="scheda mt-5 p-5">
                <h2 className="text-base font-bold text-pomodoro">
                  {daCollegare.length} voci da collegare
                </h2>
                <p className="mt-1 text-sm text-fumo">
                  Non le ho riconosciute. Collegale a un alimento e non te lo chiedo più.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {daCollegare.map((v) => (
                    <form
                      key={v.id}
                      action={collegaAlimento}
                      className="rounded-controllo flex flex-wrap items-center gap-2 bg-pomodoro-tenue px-3 py-2"
                    >
                      <input type="hidden" name="voce" value={v.id} />
                      <span className="min-w-0 flex-1 text-sm font-semibold text-inchiostro">
                        {v.testoGrezzo}
                        <span className="ml-2 text-xs font-normal text-fumo">{NOMI[v.fascia as never] ?? v.fascia}</span>
                      </span>
                      <select name="alimento" id={`collega-${v.id}`} className={`${campo} text-sm`}>
                        {vocabolario.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="bottone-chiaro">
                        Collega
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-6">
              {FASCE.map((fascia) => {
                const righe = righePerFascia(voci, fascia)
                const perFascia = arrotonda(obiettivoDa(righe))
                const ammessi = vocabolario.filter((a) => a.fasce.includes(fascia))

                return (
                  <section key={fascia} className="scheda p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h2 className="font-marchio text-2xl text-inchiostro">{NOMI[fascia]}</h2>
                      {righe.length > 0 ? (
                        <span className="cifre text-sm text-fumo">circa {perFascia.kcal} kcal</span>
                      ) : null}
                    </div>

                    {righe.length === 0 ? (
                      <p className="mt-2 text-sm text-fumo">
                        Ancora niente. Aggiungi il primo alimento qui sotto.
                      </p>
                    ) : (
                      <div className="mt-4 flex flex-col gap-4">
                        {righe.map((riga) => (
                          <div key={riga.riga} className="rounded-controllo bg-fondo p-3">
                            <p className="text-xs font-semibold text-fumo">
                              Scegli una di queste
                            </p>
                            <div className="mt-2 flex flex-col gap-1.5">
                              {riga.voci.map((v) => {
                                const q = Number(v.quantita)
                                const n = arrotonda(nutrientiDi(v.alimento, q))

                                return (
                                  <div
                                    key={v.id}
                                    className="flex flex-wrap items-center gap-2 rounded-controllo bg-bianco px-3 py-2"
                                  >
                                    <span className="min-w-0 flex-1 text-sm text-inchiostro">
                                      {v.alimento?.nome ?? v.testoGrezzo}
                                      {v.alimento ? (
                                        <span className="cifre ml-2 text-xs text-fumo">
                                          {n.kcal} kcal
                                        </span>
                                      ) : null}
                                    </span>

                                    <form action={cambiaQuantita} className="flex items-center gap-1">
                                      <input type="hidden" name="voce" value={v.id} />
                                      <input
                                        type="number"
                                        name="quantita"
                                        id={`q-${v.id}`}
                                        min={0}
                                        step={5}
                                        defaultValue={q}
                                        className="cifre w-20 rounded-controllo border border-bordo bg-fondo px-2 py-1 text-right text-sm text-inchiostro outline-none focus:border-basilico"
                                      />
                                      <span className="text-xs text-fumo">{v.unita}</span>
                                      <button type="submit" className="pillola bg-basilico-tenue text-basilico-scuro">
                                        Salva
                                      </button>
                                    </form>

                                    <form action={togliVoce}>
                                      <input type="hidden" name="voce" value={v.id} />
                                      <button type="submit" className="pillola bg-pomodoro-tenue text-pomodoro">
                                        Togli
                                      </button>
                                    </form>
                                  </div>
                                )
                              })}

                              <form action={aggiungiVoce} className="mt-1 flex flex-wrap items-center gap-2">
                                <input type="hidden" name="lista" value={lista.id} />
                                <input type="hidden" name="fascia" value={fascia} />
                                <input type="hidden" name="riga" value={riga.riga} />
                                <select
                                  name="alimento"
                                  id={`alt-${fascia}-${riga.riga}`}
                                  className={`${campo} flex-1 text-sm`}
                                >
                                  {ammessi.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.nome}
                                    </option>
                                  ))}
                                </select>
                                <button type="submit" className="bottone-chiaro">
                                  Aggiungi alternativa
                                </button>
                              </form>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <form action={aggiungiVoce} className="mt-4 flex flex-wrap items-center gap-2 border-t border-bordo pt-4">
                      <input type="hidden" name="lista" value={lista.id} />
                      <input type="hidden" name="fascia" value={fascia} />
                      <select name="alimento" id={`nuovo-${fascia}`} className={`${campo} flex-1 text-sm`}>
                        {ammessi.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="bottone hover:bg-basilico-scuro">
                        Aggiungi a {NOMI[fascia].toLowerCase()}
                      </button>
                    </form>
                  </section>
                )
              })}
            </div>

            {liste.length > 1 ? (
              <section className="scheda mt-8 p-5">
                <h2 className="text-base font-bold text-inchiostro">Le altre liste</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {liste.map((l) => (
                    <div
                      key={l.id}
                      className="rounded-controllo flex flex-wrap items-center gap-2 bg-fondo px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 text-sm text-inchiostro">
                        {l.nome}
                        {l.attiva ? (
                          <span className="pillola ml-2 bg-basilico-tenue text-basilico-scuro">in uso</span>
                        ) : null}
                      </span>
                      {!l.attiva ? (
                        <>
                          <form action={rendiAttiva}>
                            <input type="hidden" name="lista" value={l.id} />
                            <button type="submit" className="pillola bg-basilico-tenue text-basilico-scuro">
                              Usa questa
                            </button>
                          </form>
                          <form action={eliminaLista}>
                            <input type="hidden" name="lista" value={l.id} />
                            <button type="submit" className="pillola bg-pomodoro-tenue text-pomodoro">
                              Elimina
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
      <Navigazione />
    </div>
  )
}
