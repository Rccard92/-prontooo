import Link from 'next/link'
import { asc } from 'drizzle-orm'

import { alimenti as tabellaAlimenti, db } from '@prontooo/db'

import { diStagione, meseCorrente } from '@prontooo/db/alimenti'

import { utenteConProfilo } from '@/lib/accesso/sessione'
import { PASSI_TOTALI } from '@/lib/benvenuto/passi'
import { CATEGORIE } from '@/lib/lista/gusti'
import { ammessi } from '@/lib/nutrizione/esclusioni'
import { leggiProfilo } from '@/lib/profilo/leggi'
import { NOME_FASCIA, eFascia } from '@/lib/ricette/fasce'

import { Testata } from '../../componenti/testata'
import { salvaGusti } from '../azioni'

export const dynamic = 'force-dynamic'

const NOMI_MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]

/** Il primo mese buono a partire da adesso: "torna a ottobre". */
function primoMese(mesi: number[]): string {
  const oggi = meseCorrente()

  for (let avanti = 1; avanti <= 12; avanti += 1) {
    const mese = ((oggi - 1 + avanti) % 12) + 1

    if (mesi.includes(mese)) return NOMI_MESI[mese - 1]!
  }

  return 'mai'
}

/** "pranzo, cena" scritto come lo leggi, non come sta nel database. */
function doveFinisce(fasce: string[]): string {
  const nomi = fasce.filter(eFascia).map((f) => NOME_FASCIA[f].toLowerCase())

  return nomi.length === 0 ? 'nessun pasto' : nomi.join(', ')
}

export default async function Gusti({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string; benvenuto?: string }>
}) {
  const utenteId = await utenteConProfilo()
  const { errore, benvenuto } = await searchParams

  const [tuttiGliAlimenti, profilo] = await Promise.all([
    db()
      .select({
        id: tabellaAlimenti.id,
        nome: tabellaAlimenti.nome,
        gruppo: tabellaAlimenti.gruppo,
        fasce: tabellaAlimenti.fasce,
        quantita: tabellaAlimenti.quantita,
        unita: tabellaAlimenti.unita,
        mesiStagione: tabellaAlimenti.mesiStagione,
        etichette: tabellaAlimenti.etichette,
        occasionale: tabellaAlimenti.occasionale,
      })
      .from(tabellaAlimenti)
      .orderBy(asc(tabellaAlimenti.nome)),
    leggiProfilo(utenteId),
  ])

  // Chi ha tolto il pesce non deve vederselo fra le caselle da spuntare: la
  // scelta fatta nel profilo si propaga qui, altrimenti che senso avrebbe.
  const esclusioni = profilo?.esclusioni ?? []
  const vocabolario = ammessi(tuttiGliAlimenti, esclusioni, (a) => a.etichette)
  const nascosti = tuttiGliAlimenti.length - vocabolario.length

  const gia = new Set(profilo?.alimentiScelti ?? [])
  const mese = meseCorrente()
  const nomeMese = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(
    new Date(2026, mese - 1, 1),
  )

  return (
    <div className="min-h-dvh bg-fondo">
      {benvenuto ? (
        <header className="border-b border-bordo bg-bianco/90 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <span className="font-marchio text-2xl leading-none text-inchiostro">èProntooo</span>
            <span className="cifre text-sm text-fumo">
              {PASSI_TOTALI} di {PASSI_TOTALI}
            </span>
          </div>
          <div className="mx-auto mt-3 flex max-w-3xl gap-1">
            {Array.from({ length: PASSI_TOTALI }, (_, i) => (
              <span key={i} className="h-1 flex-1 rounded-full bg-basilico" />
            ))}
          </div>
        </header>
      ) : (
        <Testata attiva="ingredienti" />
      )}

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {benvenuto ? null : (
          <Link href="/ingredienti" className="text-sm font-semibold text-fumo hover:text-basilico">
            Torna agli ingredienti
          </Link>
        )}

        <h1 className="font-marchio mt-3 text-3xl text-inchiostro sm:text-4xl">
          Cosa ti piace mangiare
        </h1>
        <p className="mt-2 max-w-2xl text-base text-fumo">
          Spunta quello che mangi volentieri, categoria per categoria. Da qui costruisco i pasti e
          cerco le ricette: quello che non spunti non compare, mai. Sotto ogni alimento c&rsquo;è
          scritto in quali pasti può finire — la fettina non arriverà a colazione.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-fumo">
          Spunta pure tutto quello che ti piace, anche quello che adesso non si trova: la frutta e
          la verdura seguono l&rsquo;anno, e ognuna torna nel suo mese. Quello che a{' '}
          {nomeMese} è fuori stagione è segnato qui sotto, e in questo periodo non finisce nei
          pasti.
        </p>

        {nascosti > 0 ? (
          <p className="rounded-controllo mt-4 bg-fondo px-4 py-3 text-sm text-fumo">
            {nascosti} alimenti non compaiono perché li hai tolti nel profilo.{' '}
            <Link href="/profilo" className="font-semibold text-basilico-scuro underline underline-offset-4">
              Cambia cosa togliere
            </Link>
            .
          </p>
        ) : null}

        {errore ? (
          <p className="rounded-controllo mt-5 bg-pomodoro-tenue px-4 py-3 text-sm text-pomodoro">
            {errore}
          </p>
        ) : null}

        <form action={salvaGusti}>
          {benvenuto ? <input type="hidden" name="poi" value="oggi" /> : null}

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
                          {a.occasionale ? (
                            <span className="mt-1 block text-xs font-semibold text-fumo">
                              ogni tanto · lo registri sempre, nel piano esce di rado
                            </span>
                          ) : null}
                          {a.mesiStagione.length > 0 && !diStagione(a.mesiStagione, mese) ? (
                            <span className="mt-1 block text-xs font-semibold text-pomodoro">
                              fuori stagione a {nomeMese} · torna a {primoMese(a.mesiStagione)}
                            </span>
                          ) : null}
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
              {benvenuto ? 'Fatto, costruisci la mia giornata' : 'Salva e costruisci i pasti'}
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
