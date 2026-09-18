import Link from 'next/link'
import { asc } from 'drizzle-orm'

import { alimenti as tabellaAlimenti, db } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { CATEGORIE } from '@/lib/lista/gusti'
import { leggiProfilo } from '@/lib/profilo/leggi'
import { NOME_FASCIA, eFascia } from '@/lib/ricette/fasce'

import { Testata } from '../../componenti/testata'
import { salvaGusti } from '../azioni'

export const dynamic = 'force-dynamic'

/** "pranzo, cena" scritto come lo leggi, non come sta nel database. */
function doveFinisce(fasce: string[]): string {
  const nomi = fasce.filter(eFascia).map((f) => NOME_FASCIA[f].toLowerCase())

  return nomi.length === 0 ? 'nessun pasto' : nomi.join(', ')
}

export default async function Gusti({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  const utenteId = await utenteObbligatorio()
  const { errore } = await searchParams

  const [vocabolario, profilo] = await Promise.all([
    db()
      .select({
        id: tabellaAlimenti.id,
        nome: tabellaAlimenti.nome,
        gruppo: tabellaAlimenti.gruppo,
        fasce: tabellaAlimenti.fasce,
        quantita: tabellaAlimenti.quantita,
        unita: tabellaAlimenti.unita,
      })
      .from(tabellaAlimenti)
      .orderBy(asc(tabellaAlimenti.nome)),
    leggiProfilo(utenteId),
  ])

  const gia = new Set(profilo?.alimentiScelti ?? [])

  return (
    <div className="min-h-dvh bg-fondo">
      <Testata attiva="ingredienti" />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/ingredienti" className="text-sm font-semibold text-fumo hover:text-basilico">
          Torna agli ingredienti
        </Link>

        <h1 className="font-marchio mt-3 text-3xl text-inchiostro sm:text-4xl">
          Cosa ti piace mangiare
        </h1>
        <p className="mt-2 max-w-2xl text-base text-fumo">
          Spunta quello che mangi volentieri, categoria per categoria. Da qui costruisco i pasti e
          cerco le ricette: quello che non spunti non compare, mai. Sotto ogni alimento c&rsquo;è
          scritto in quali pasti può finire — la fettina non arriverà a colazione.
        </p>

        {errore ? (
          <p className="rounded-controllo mt-5 bg-pomodoro-tenue px-4 py-3 text-sm text-pomodoro">
            {errore}
          </p>
        ) : null}

        <form action={salvaGusti}>
          <div className="mt-6 flex flex-col gap-5">
            {CATEGORIE.map((categoria) => {
              const suoi = vocabolario.filter((a) => a.gruppo === categoria.gruppo)

              if (suoi.length === 0) return null

              const spuntati = suoi.filter((a) => gia.has(a.id)).length

              return (
                <section key={categoria.gruppo} className="scheda p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-marchio text-xl text-inchiostro">{categoria.nome}</h2>
                    <span className="cifre text-sm text-fumo">
                      {spuntati > 0 ? `${spuntati} su ${suoi.length}` : `${suoi.length} da spuntare`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-fumo">{categoria.spiega}</p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {suoi.map((a) => (
                      <label
                        key={a.id}
                        className="rounded-controllo flex cursor-pointer items-start gap-3 bg-fondo px-3 py-2 hover:bg-basilico-tenue"
                      >
                        <input
                          type="checkbox"
                          name="alimento"
                          value={a.id}
                          defaultChecked={gia.has(a.id)}
                          className="mt-1 size-4 shrink-0 accent-basilico"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-inchiostro">{a.nome}</span>
                          <span className="cifre block text-xs text-fumo">
                            {a.quantita} {a.unita} · {doveFinisce(a.fasce)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

          <div className="sticky bottom-0 mt-6 border-t border-bordo bg-fondo/95 py-4 backdrop-blur">
            <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
              Salva e costruisci i pasti
            </button>
            <p className="mt-2 text-center text-xs text-fumo">
              Sostituisce la lista attiva. Le quantità sono le porzioni tipiche e le correggi dopo.
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}
