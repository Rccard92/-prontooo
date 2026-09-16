import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { db, profilo as tabellaProfilo } from '@prontooo/db'

import { FASCE, NOME_FASCIA } from '@/lib/ricette/fasce'
import { PROFILO_PREDEFINITO, leggiProfilo } from '@/lib/piano/genera'
import { GIORNI } from '@/lib/piano/settimana'

import { Testata } from '../componenti/testata'

export const dynamic = 'force-dynamic'

function numero(dati: FormData, campo: string, predefinito: number): number {
  const valore = Number(dati.get(campo))

  return Number.isFinite(valore) && valore >= 0 ? Math.round(valore) : predefinito
}

async function salva(dati: FormData) {
  'use server'

  const fasceAttive = FASCE.filter((f) => dati.get(`fascia-${f}`) === 'si')

  const minutiMassimi: Record<string, number> = {}
  for (const fascia of fasceAttive) {
    minutiMassimi[fascia] = numero(dati, `minuti-${fascia}`, 45)
  }

  const giorniFuoriPranzo: number[] = GIORNI.map((_, i) => i).filter(
    (i) => dati.get(`fuori-${i}`) === 'si',
  )

  const daEvitare = String(dati.get('daEvitare') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  const valori = {
    id: 1,
    adulti: numero(dati, 'adulti', 2),
    bambini: numero(dati, 'bambini', 0),
    porzioniDefault: numero(dati, 'porzioni', 2),
    fasceAttive: (fasceAttive.length > 0 ? [...fasceAttive] : ['pranzo', 'cena']) as string[],
    giorniFuoriPranzo,
    minutiMassimi,
    daEvitare,
    settimaneAntiRipetizione: numero(dati, 'antiRipetizione', 3),
    aggiornatoIl: new Date(),
  }

  await db()
    .insert(tabellaProfilo)
    .values(valori)
    .onConflictDoUpdate({ target: tabellaProfilo.id, set: valori })

  redirect('/?generato=1')
}

function Sezione({
  titolo,
  spiega,
  children,
}: {
  titolo: string
  spiega?: string
  children: React.ReactNode
}) {
  return (
    <section className="scheda p-6 sm:p-8">
      <h2 className="font-marchio text-2xl text-inchiostro">{titolo}</h2>
      {spiega ? <p className="mt-2 text-sm text-fumo">{spiega}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  )
}

const campo =
  'rounded-controllo w-full border border-bordo bg-fondo px-3 py-2 text-base text-inchiostro outline-none focus:border-basilico'

function Numero({
  nome,
  etichetta,
  valore,
  max = 20,
}: {
  nome: string
  etichetta: string
  valore: number
  max?: number
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-inchiostro">{etichetta}</span>
      <input
        type="number"
        name={nome}
        id={nome}
        min={0}
        max={max}
        defaultValue={valore}
        className={`${campo} cifre mt-1.5`}
      />
    </label>
  )
}

export default async function Wizard() {
  const salvato = await leggiProfilo()
  const p = salvato ?? { ...PROFILO_PREDEFINITO, aggiornatoIl: new Date() }

  return (
    <div className="min-h-dvh bg-fondo">
      <Testata />

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">
          {salvato ? 'Le tue preferenze' : 'Due minuti e poi ci penso io'}
        </h1>
        <p className="mt-2 text-base text-fumo">
          Da queste risposte nasce il piano della settimana. Puoi cambiarle quando vuoi.
        </p>

        <form action={salva} className="mt-8 flex flex-col gap-5">
          <Sezione titolo="Chi mangia">
            <div className="grid grid-cols-3 gap-4">
              <Numero nome="adulti" etichetta="Adulti" valore={p.adulti} />
              <Numero nome="bambini" etichetta="Bambini" valore={p.bambini} />
              <Numero nome="porzioni" etichetta="Porzioni" valore={p.porzioniDefault} />
            </div>
          </Sezione>

          <Sezione
            titolo="Cosa pianifico"
            spiega="Spunta solo i pasti che vuoi davvero nel piano, e dimmi quanto tempo hai per ognuno."
          >
            <div className="flex flex-col gap-3">
              {FASCE.map((fascia) => {
                const attiva = p.fasceAttive.includes(fascia)

                return (
                  <div
                    key={fascia}
                    className="rounded-controllo flex items-center justify-between gap-4 bg-fondo px-4 py-3"
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name={`fascia-${fascia}`}
                        id={`fascia-${fascia}`}
                        value="si"
                        defaultChecked={attiva}
                        className="size-5 accent-basilico"
                      />
                      <span className="text-base font-semibold text-inchiostro">
                        {NOME_FASCIA[fascia]}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 text-sm text-fumo">
                      entro
                      <input
                        type="number"
                        name={`minuti-${fascia}`}
                        id={`minuti-${fascia}`}
                        min={5}
                        max={240}
                        step={5}
                        defaultValue={p.minutiMassimi[fascia] ?? 45}
                        className="cifre rounded-controllo w-20 border border-bordo bg-bianco px-2 py-1.5 text-right text-inchiostro outline-none focus:border-basilico"
                      />
                      min
                    </label>
                  </div>
                )
              })}
            </div>
          </Sezione>

          <Sezione
            titolo="Quando sei fuori a pranzo"
            spiega="Quei pranzi non entrano nel piano e non finiscono nella lista della spesa."
          >
            <div className="flex flex-wrap gap-2">
              {GIORNI.map((giorno, i) => (
                <label
                  key={giorno}
                  className="rounded-controllo flex items-center gap-2 bg-fondo px-3 py-2"
                >
                  <input
                    type="checkbox"
                    name={`fuori-${i}`}
                    id={`fuori-${i}`}
                    value="si"
                    defaultChecked={p.giorniFuoriPranzo.includes(i)}
                    className="size-4 accent-basilico"
                  />
                  <span className="text-sm font-semibold text-inchiostro">
                    {giorno.slice(0, 3)}
                  </span>
                </label>
              ))}
            </div>
          </Sezione>

          <Sezione
            titolo="Cosa non vuoi vedere"
            spiega="Separati da virgola. Cerco queste parole nel testo degli ingredienti e scarto le ricette che le contengono."
          >
            <input
              type="text"
              name="daEvitare"
              id="daEvitare"
              defaultValue={p.daEvitare.join(', ')}
              placeholder="maiale, funghi, gorgonzola"
              className={campo}
            />
            <p className="rounded-controllo bg-limone-tenue mt-4 px-4 py-3 text-sm text-inchiostro">
              È una ricerca sul testo, non un controllo sugli allergeni. Per le allergie serve la
              normalizzazione degli ingredienti, che ancora non c&rsquo;è: non fidarti di questo
              campo per decidere se puoi mangiare qualcosa.
            </p>
          </Sezione>

          <Sezione
            titolo="Ogni quanto può tornare una ricetta"
            spiega="Per quante settimane una ricetta già cucinata resta fuori dal piano."
          >
            <Numero
              nome="antiRipetizione"
              etichetta="Settimane"
              valore={p.settimaneAntiRipetizione}
              max={12}
            />
          </Sezione>

          <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
            {salvato ? 'Salva le preferenze' : 'Salva e genera la settimana'}
          </button>
        </form>
      </main>
    </div>
  )
}
