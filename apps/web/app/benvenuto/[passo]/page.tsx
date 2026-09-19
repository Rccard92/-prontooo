import { notFound, redirect } from 'next/navigation'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { CONDIZIONI, chiaveRegola } from '@/lib/nutrizione/condizioni'
import {
  ATTIVITA,
  type DatiCorpo,
  NOME_ATTIVITA,
  NOME_OBIETTIVO,
  OBIETTIVI,
  datiCompleti,
  fabbisognoDi,
} from '@/lib/nutrizione/fabbisogno'
import { ESCLUSIONI } from '@/lib/nutrizione/impostazioni'
import { leggiProfilo } from '@/lib/profilo/leggi'

import { salvaCondizioni, salvaCorpo, salvaEsclusioni, salvaMovimento } from '../azioni'
import { PASSI_TOTALI, SOTTOTITOLO, TITOLO, ePasso, numeroDi } from '@/lib/benvenuto/passi'

export const dynamic = 'force-dynamic'

const campo =
  'rounded-controllo w-full border border-bordo bg-fondo px-3 py-2.5 text-base text-inchiostro outline-none focus:border-basilico'

const scelta =
  'rounded-controllo flex cursor-pointer items-start gap-3 bg-fondo px-4 py-3 hover:bg-basilico-tenue'

export default async function Benvenuto({
  params,
  searchParams,
}: {
  params: Promise<{ passo: string }>
  searchParams: Promise<{ errore?: string }>
}) {
  const { passo } = await params

  if (!ePasso(passo)) notFound()

  const { errore } = await searchParams
  const utenteId = await utenteObbligatorio()
  const p = await leggiProfilo(utenteId)

  // Non si salta avanti: senza i dati del corpo gli altri passi non hanno
  // niente su cui appoggiarsi.
  if (passo !== 'corpo' && (p?.eta === null || p?.eta === undefined)) redirect('/benvenuto/corpo')

  const corpo: Partial<DatiCorpo> = {
    sesso: (p?.sesso ?? undefined) as DatiCorpo['sesso'] | undefined,
    eta: p?.eta ?? undefined,
    altezza: p?.altezza ?? undefined,
    pesoKg: p?.pesoKg === null || p?.pesoKg === undefined ? undefined : Number(p.pesoKg),
    attivita: (p?.attivita ?? undefined) as DatiCorpo['attivita'] | undefined,
    obiettivo: (p?.obiettivo ?? undefined) as DatiCorpo['obiettivo'] | undefined,
  }

  const conto = datiCompleti(corpo) ? fabbisognoDi(corpo) : null

  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="border-b border-bordo bg-bianco/90 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
          <span className="font-marchio text-2xl leading-none text-inchiostro">èProntooo</span>
          <span className="cifre text-sm text-fumo">
            {numeroDi(passo)} di {PASSI_TOTALI}
          </span>
        </div>

        <div className="mx-auto mt-3 flex max-w-xl gap-1">
          {Array.from({ length: PASSI_TOTALI }, (_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i < numeroDi(passo) ? 'bg-basilico' : 'bg-fondo'}`}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-marchio text-3xl text-inchiostro">{TITOLO[passo]}</h1>
        <p className="mt-2 text-base text-fumo">{SOTTOTITOLO[passo]}</p>

        {errore ? (
          <p className="rounded-controllo mt-5 bg-pomodoro-tenue px-4 py-3 text-sm text-pomodoro">
            {errore}
          </p>
        ) : null}

        {passo === 'corpo' ? (
          <form action={salvaCorpo} className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-semibold text-inchiostro">Sesso</span>
                <select name="sesso" defaultValue={corpo.sesso ?? 'uomo'} className={`${campo} mt-1.5`}>
                  <option value="uomo">Uomo</option>
                  <option value="donna">Donna</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-inchiostro">Età</span>
                <input
                  type="number"
                  name="eta"
                  min={14}
                  max={100}
                  required
                  defaultValue={corpo.eta ?? ''}
                  className={`${campo} cifre mt-1.5`}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-semibold text-inchiostro">Altezza in cm</span>
                <input
                  type="number"
                  name="altezza"
                  min={120}
                  max={230}
                  required
                  defaultValue={corpo.altezza ?? ''}
                  className={`${campo} cifre mt-1.5`}
                />
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-inchiostro">Peso in kg</span>
                <input
                  type="text"
                  name="peso"
                  inputMode="decimal"
                  required
                  defaultValue={corpo.pesoKg ?? ''}
                  className={`${campo} cifre mt-1.5`}
                />
              </label>
            </div>

            <button type="submit" className="bottone mt-2 w-full hover:bg-basilico-scuro">
              Avanti
            </button>
          </form>
        ) : null}

        {passo === 'movimento' ? (
          <form action={salvaMovimento} className="mt-6 flex flex-col gap-5">
            <fieldset>
              <legend className="text-sm font-semibold text-inchiostro">In una settimana</legend>
              <div className="mt-2 flex flex-col gap-2">
                {ATTIVITA.map((a) => (
                  <label key={a} className={scelta}>
                    <input
                      type="radio"
                      name="attivita"
                      value={a}
                      defaultChecked={(corpo.attivita ?? 'moderato') === a}
                      className="mt-0.5 size-5 shrink-0 accent-basilico"
                    />
                    <span className="text-base text-inchiostro">{NOME_ATTIVITA[a]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-inchiostro">Cosa vuoi ottenere</legend>
              <div className="mt-2 flex flex-col gap-2">
                {OBIETTIVI.map((o) => (
                  <label key={o} className={scelta}>
                    <input
                      type="radio"
                      name="obiettivo"
                      value={o}
                      defaultChecked={(corpo.obiettivo ?? 'mantenere') === o}
                      className="mt-0.5 size-5 shrink-0 accent-basilico"
                    />
                    <span className="text-base text-inchiostro">{NOME_OBIETTIVO[o]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
              Avanti
            </button>
          </form>
        ) : null}

        {passo === 'togliere' ? (
          <form action={salvaEsclusioni} className="mt-6 flex flex-col gap-4">
            {conto ? (
              <p className="rounded-controllo bg-basilico-tenue px-4 py-3 text-sm text-basilico-scuro">
                Coi tuoi numeri vengono <strong className="cifre">{conto.giornaliero} kcal</strong> al
                giorno, con {conto.proteine} g di proteine. Da qui escono i grammi dei pasti.
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              {ESCLUSIONI.map((e) => (
                <label key={e.id} className={scelta}>
                  <input
                    type="checkbox"
                    name={`esclusione-${e.id}`}
                    value="si"
                    defaultChecked={p?.esclusioni.includes(e.id)}
                    className="mt-0.5 size-5 shrink-0 accent-basilico"
                  />
                  <span>
                    <span className="block text-base font-semibold text-inchiostro">{e.nome}</span>
                    <span className="block text-sm text-fumo">{e.spiega}</span>
                  </span>
                </label>
              ))}
            </div>

            <p className="text-sm text-fumo">
              Se non devi togliere niente, vai avanti così.
            </p>

            <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
              Avanti
            </button>
          </form>
        ) : null}

        {passo === 'salute' ? (
          <form action={salvaCondizioni} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {CONDIZIONI.map((c) => (
                <div key={c.id} className="rounded-controllo bg-fondo p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      name={`condizione-${c.id}`}
                      value="si"
                      defaultChecked={p?.condizioni.includes(c.id)}
                      className="mt-0.5 size-5 shrink-0 accent-basilico"
                    />
                    <span>
                      <span className="block text-base font-semibold text-inchiostro">{c.nome}</span>
                      <span className="block text-sm text-fumo">{c.spiega}</span>
                    </span>
                  </label>

                  <div className="mt-3 flex flex-col gap-2 border-t border-bordo pt-3">
                    {c.regole.map((r) => (
                      <label
                        key={r.id}
                        className="rounded-controllo flex cursor-pointer items-start gap-3 bg-bianco px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          name={`regola-${chiaveRegola(c.id, r.id)}`}
                          value="si"
                          defaultChecked={!p?.regoleSpente.includes(chiaveRegola(c.id, r.id))}
                          className="mt-0.5 size-4 shrink-0 accent-basilico"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-inchiostro">
                            {r.cosaFa}
                          </span>
                          <span className="block text-xs text-fumo">{r.quantoSiSa}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="rounded-controllo bg-limone-tenue px-4 py-3 text-sm text-inchiostro">
              Nessuna di queste toglie un alimento per sempre: spostano quanto spesso esce. E si
              cambiano quando vuoi dal profilo.
            </p>

            <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
              Scegli cosa ti piace
            </button>
          </form>
        ) : null}
      </main>
    </div>
  )
}
