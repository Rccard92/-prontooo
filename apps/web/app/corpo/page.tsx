import Link from 'next/link'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import {
  ATTIVITA,
  type DatiCorpo,
  NOME_ATTIVITA,
  NOME_OBIETTIVO,
  OBIETTIVI,
  datiCompleti,
  fabbisognoDi,
} from '@/lib/nutrizione/fabbisogno'
import { leggiProfilo } from '@/lib/profilo/leggi'

import { Testata } from '../componenti/testata'

import { dimenticaCorpo, salvaCorpo } from './azioni'

export const dynamic = 'force-dynamic'

const campo =
  'rounded-controllo border border-bordo bg-fondo px-3 py-2 text-base text-inchiostro outline-none focus:border-basilico'

export default async function Corpo({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string; salvato?: string }>
}) {
  const utenteId = await utenteObbligatorio()
  const { errore, salvato } = await searchParams
  const profilo = await leggiProfilo(utenteId)

  const corpo: Partial<DatiCorpo> = {
    sesso: (profilo?.sesso ?? undefined) as DatiCorpo['sesso'] | undefined,
    eta: profilo?.eta ?? undefined,
    altezza: profilo?.altezza ?? undefined,
    pesoKg: profilo?.pesoKg === null || profilo?.pesoKg === undefined ? undefined : Number(profilo.pesoKg),
    attivita: (profilo?.attivita ?? undefined) as DatiCorpo['attivita'] | undefined,
    obiettivo: (profilo?.obiettivo ?? undefined) as DatiCorpo['obiettivo'] | undefined,
  }

  const conto = datiCompleti(corpo) ? fabbisognoDi(corpo) : null

  return (
    <div className="min-h-dvh bg-fondo">
      <Testata />

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">Le tue porzioni</h1>
        <p className="mt-2 max-w-xl text-fumo">
          Finché non compili questo, i grammi che vedi nei pasti sono porzioni di riferimento:
          ottanta grammi di pasta, centocinquanta di pollo. Ragionevoli per un adulto medio, ma
          non tue. Da qui invece si calcolano.
        </p>

        {errore ? (
          <p className="rounded-controllo mt-5 bg-pomodoro-tenue px-4 py-3 text-sm text-pomodoro">
            {errore}
          </p>
        ) : null}

        {salvato && conto ? (
          <p className="rounded-controllo mt-5 bg-basilico-tenue px-4 py-3 text-sm text-basilico-scuro">
            Fatto. Da adesso i pasti si scalano su di te.
          </p>
        ) : null}

        {conto ? (
          <section className="scheda mt-6 p-5">
            <h2 className="font-marchio text-xl text-inchiostro">Quello che ne esce</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { nome: 'Kcal al giorno', valore: String(conto.giornaliero) },
                { nome: 'Proteine', valore: `${conto.proteine} g` },
                { nome: 'Carboidrati', valore: `${conto.carboidrati} g` },
                { nome: 'Grassi', valore: `${conto.grassi} g` },
              ].map((v) => (
                <div key={v.nome} className="rounded-controllo bg-fondo px-4 py-3">
                  <p className="cifre text-xl font-bold text-inchiostro">{v.valore}</p>
                  <p className="text-sm text-fumo">{v.nome}</p>
                </div>
              ))}
            </div>
            <p className="cifre mt-3 text-sm text-fumo">
              Fermo consumeresti {conto.basale} kcal: è il metabolismo basale, e sotto quello non
              si scende mai.
            </p>
          </section>
        ) : null}

        <form action={salvaCorpo} className="scheda mt-6 flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-inchiostro">Sesso</span>
              <select name="sesso" defaultValue={corpo.sesso ?? 'uomo'} className={campo}>
                <option value="uomo">Uomo</option>
                <option value="donna">Donna</option>
              </select>
              <span className="text-xs text-fumo">Cambia la formula del metabolismo.</span>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-inchiostro">Età</span>
              <input
                type="number"
                name="eta"
                min={14}
                max={100}
                required
                defaultValue={corpo.eta ?? ''}
                className={`cifre ${campo}`}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-inchiostro">Altezza in centimetri</span>
              <input
                type="number"
                name="altezza"
                min={120}
                max={230}
                required
                defaultValue={corpo.altezza ?? ''}
                className={`cifre ${campo}`}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-inchiostro">Peso in chili</span>
              <input
                type="text"
                name="peso"
                inputMode="decimal"
                required
                defaultValue={corpo.pesoKg ?? ''}
                className={`cifre ${campo}`}
              />
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-inchiostro">Quanto ti muovi</legend>
            <div className="flex flex-col gap-1.5">
              {ATTIVITA.map((a) => (
                <label
                  key={a}
                  className="rounded-controllo flex cursor-pointer items-center gap-3 bg-fondo px-3 py-2"
                >
                  <input
                    type="radio"
                    name="attivita"
                    value={a}
                    defaultChecked={(corpo.attivita ?? 'moderato') === a}
                    className="size-4 accent-basilico"
                  />
                  <span className="text-sm text-inchiostro">{NOME_ATTIVITA[a]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-inchiostro">Cosa vuoi ottenere</legend>
            <div className="flex flex-wrap gap-2">
              {OBIETTIVI.map((o) => (
                <label
                  key={o}
                  className="rounded-controllo flex cursor-pointer items-center gap-2 bg-fondo px-3 py-2"
                >
                  <input
                    type="radio"
                    name="obiettivo"
                    value={o}
                    defaultChecked={(corpo.obiettivo ?? 'mantenere') === o}
                    className="size-4 accent-basilico"
                  />
                  <span className="text-sm text-inchiostro">{NOME_OBIETTIVO[o]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" className="bottone hover:bg-basilico-scuro">
            Calcola le mie porzioni
          </button>
        </form>

        <div className="rounded-scheda mt-5 bg-limone-tenue px-5 py-4">
          <p className="font-semibold text-inchiostro">È una stima, e va detto</p>
          <p className="mt-1 text-sm text-inchiostro">
            Il conto è quello standard — Mifflin-St Jeor per il metabolismo, il fattore di
            attività, l&rsquo;obiettivo — e i valori degli alimenti vengono dalle tabelle CREA.
            Serve ad avere porzioni sensate, non a sostituire un nutrizionista: lui guarda esami,
            storia e cose che una formula non vede. Se hai una dieta vera,{' '}
            <Link href="/ingredienti" className="font-semibold underline underline-offset-4">
              caricala e vince quella
            </Link>
            .
          </p>
        </div>

        {conto ? (
          <form action={dimenticaCorpo} className="mt-5">
            <button type="submit" className="pillola bg-bianco text-fumo">
              Cancella i miei dati e torna alle porzioni standard
            </button>
          </form>
        ) : null}
      </main>
    </div>
  )
}
