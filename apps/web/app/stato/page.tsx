import { count, desc } from 'drizzle-orm'

import { allergeni, battiti, db } from '@prontooo/db'

import { Navigazione } from '../componenti/navigazione'

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
    // Il dettaglio resta nei log di Railway: un errore di connessione contiene
    // host e utente del database, e non e' roba da mettere su una pagina.
    console.error('lettura stato impianto fallita:', errore)

    return [
      { nome: 'Database Postgres', valore: 'non risponde, guarda i log', esito: 'rotto' },
      { nome: 'Worker di ingestione', valore: 'non verificabile senza database', esito: 'attesa' },
    ]
  }
}

const segno = {
  ok: 'bg-basilico',
  attesa: 'bg-limone',
  rotto: 'bg-pomodoro',
} as const

function Riga({ voce }: { voce: Voce }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <dt className="flex items-center gap-3 text-base font-semibold text-inchiostro">
        <span className={`inline-block size-2.5 rounded-full ${segno[voce.esito]}`} aria-hidden />
        {voce.nome}
      </dt>
      <dd className="cifre pl-[1.375rem] text-sm text-fumo sm:pl-0 sm:text-right">{voce.valore}</dd>
    </div>
  )
}

export default async function Stato() {
  const stato = await leggiStato()

  return (
    <div className="min-h-dvh bg-fondo">
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">Stato dell&rsquo;impianto</h1>

        <dl className="scheda mt-6 divide-y divide-bordo overflow-hidden">
          <Riga voce={{ nome: 'Applicazione web', valore: 'in linea', esito: 'ok' }} />
          {stato.map((voce) => (
            <Riga key={voce.nome} voce={voce} />
          ))}
        </dl>

        <p className="mt-4 px-1 text-sm text-fumo">
          Questa pagina non è l&rsquo;app: è la prova che l&rsquo;impianto sotto regge.
        </p>
      </main>
      <Navigazione />
    </div>
  )
}
