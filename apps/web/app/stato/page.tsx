import { count, desc } from 'drizzle-orm'

import { allergeni, battiti, db } from '@prontooo/db'

import { Testata } from '../componenti/testata'

export const dynamic = 'force-dynamic'

type Voce = {
  nome: string
  valore: string
  esito: 'ok' | 'attesa' | 'rotto'
}

const orologio = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Rome',
})

async function leggiStato(): Promise<Voce[]> {
  try {
    const connessione = db()

    const [conteggio] = await connessione.select({ n: count() }).from(allergeni)
    const [ultimo] = await connessione
      .select()
      .from(battiti)
      .orderBy(desc(battiti.registratoIl))
      .limit(1)

    return [
      {
        nome: 'Database Postgres',
        valore: `collegato, ${conteggio?.n ?? 0} allergeni in tabella`,
        esito: 'ok',
      },
      ultimo
        ? {
            nome: 'Worker di ingestione',
            valore: `ultimo giro ${orologio.format(ultimo.registratoIl)}`,
            esito: 'ok',
          }
        : {
            nome: 'Worker di ingestione',
            valore: 'non ha ancora lasciato un battito',
            esito: 'attesa',
          },
    ]
  } catch (errore) {
    // Il dettaglio resta nei log di Railway: l'app e' pubblica finche' non arriva
    // la passphrase, e un errore di connessione contiene host e utente del database.
    console.error('lettura stato impianto fallita:', errore)

    return [
      {
        nome: 'Database Postgres',
        valore: 'non risponde, guarda i log del deploy',
        esito: 'rotto',
      },
      { nome: 'Worker di ingestione', valore: 'non verificabile senza database', esito: 'attesa' },
    ]
  }
}

const segno = {
  ok: 'bg-foglia',
  attesa: 'bg-zagara',
  rotto: 'bg-sangue',
} as const

function Riga({ voce }: { voce: Voce }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
      <dt className="flex items-baseline gap-3 text-base text-carta">
        <span className={`inline-block size-2 translate-y-[-1px] ${segno[voce.esito]}`} aria-hidden />
        {voce.nome}
      </dt>
      <dd className="pl-5 text-base text-carta/70 sm:pl-0 sm:text-right">{voce.valore}</dd>
    </div>
  )
}

export default async function Stato() {
  const stato = await leggiStato()

  return (
    <div className="min-h-dvh bg-cobalto">
      <Testata />

      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-16">
        <div className="cornice">
          <div className="cornice-interna px-6 py-12 sm:px-12">
            <h1 className="font-display text-4xl leading-tight text-zagara sm:text-5xl">
              Stato dell&rsquo;impianto
            </h1>

            <dl className="mt-8 divide-y divide-carta/20 border-t border-carta/20">
              <Riga voce={{ nome: 'Applicazione web', valore: 'in linea', esito: 'ok' }} />
              {stato.map((voce) => (
                <Riga key={voce.nome} voce={voce} />
              ))}
            </dl>
          </div>
        </div>

        <p className="mt-6 px-1 text-sm text-carta/60">
          Questa pagina non e l&rsquo;app: e la prova che l&rsquo;impianto sotto regge.
        </p>
      </main>
    </div>
  )
}
