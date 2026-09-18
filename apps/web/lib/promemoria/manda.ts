import { and, count, eq, gte, lte, ne, sql } from 'drizzle-orm'

import { db, giornataPasti, giornate, iscrizioniPush, promemoriaMandati } from '@prontooo/db'

/**
 * Due promemoria, e due soltanto.
 *
 * Un'app che notifica di continuo la spegni, e allora non ti serve piu' a
 * niente. Quindi: la sera, se non hai registrato niente. Il giovedi', per
 * fare la settimana in tempo per la spesa. Basta.
 */
export const GENERI = ['sera', 'settimana'] as const
export type Genere = (typeof GENERI)[number]

export type Promemoria = { titolo: string; testo: string; via: string; tag: string }

const TESTI: Record<Genere, Promemoria> = {
  sera: {
    titolo: 'Com’è andata oggi?',
    testo: 'Spunta i pasti: domani il piano riparte da quello che hai mangiato davvero.',
    via: '/',
    tag: 'sera',
  },
  settimana: {
    titolo: 'Giovedì: prepara la settimana',
    testo: 'Genera i sette giorni e la lista della spesa esce da sola.',
    via: '/spesa',
    tag: 'settimana',
  },
}

/** L'ora e il giorno a Roma: i promemoria seguono te, non il fuso del server. */
export function adessoARoma(quando = new Date()) {
  const romana = new Date(quando.toLocaleString('en-US', { timeZone: 'Europe/Rome' }))

  return {
    ora: romana.getHours(),
    giornoSettimana: romana.getDay(),
    data: `${romana.getFullYear()}-${String(romana.getMonth() + 1).padStart(2, '0')}-${String(romana.getDate()).padStart(2, '0')}`,
  }
}

/** Il lunedi' della settimana prossima, che e' quella che il giovedi' si prepara. */
function lunediProssimo(data: string): string {
  const [a, m, g] = data.split('-').map(Number)
  const d = new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, g ?? 1))
  const avanti = (8 - d.getUTCDay()) % 7 || 7

  d.setUTCDate(d.getUTCDate() + avanti)

  return d.toISOString().slice(0, 10)
}

function piuGiorni(data: string, quanti: number): string {
  const [a, m, g] = data.split('-').map(Number)

  return new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, (g ?? 1) + quanti)).toISOString().slice(0, 10)
}

/**
 * Quale promemoria va mandato adesso, se ne va mandato uno.
 *
 * Un promemoria che dice una cosa che hai gia' fatto e' rumore: prima di
 * mandare si guarda se serve davvero.
 */
export async function promemoriaDovuto(quando = new Date()): Promise<Genere | null> {
  const { ora, giornoSettimana, data } = adessoARoma(quando)
  const connessione = db()

  const giaMandato = async (genere: Genere, giorno: string) => {
    const [riga] = await connessione
      .select({ quanti: count() })
      .from(promemoriaMandati)
      .where(and(eq(promemoriaMandati.genere, genere), eq(promemoriaMandati.data, giorno)))

    return (riga?.quanti ?? 0) > 0
  }

  // Giovedì sera: la settimana prossima si prepara adesso, non domenica.
  if (giornoSettimana === 4 && ora >= 18 && ora < 22 && !(await giaMandato('settimana', data))) {
    const lunedi = lunediProssimo(data)

    const [quante] = await connessione
      .select({ quanti: count() })
      .from(giornate)
      .where(and(gte(giornate.data, lunedi), lte(giornate.data, piuGiorni(lunedi, 6))))

    if ((quante?.quanti ?? 0) < 5) return 'settimana'
  }

  // La sera, e solo se la giornata e' rimasta in bianco.
  if (ora >= 21 && ora < 23 && !(await giaMandato('sera', data))) {
    const [registrati] = await connessione
      .select({ quanti: count() })
      .from(giornataPasti)
      .innerJoin(giornate, eq(giornate.id, giornataPasti.giornataId))
      .where(and(eq(giornate.data, data), ne(giornataPasti.stato, 'previsto')))

    if ((registrati?.quanti ?? 0) === 0) return 'sera'
  }

  return null
}

export type EsitoInvio = { genere: Genere | null; mandati: number; scadute: number }

/**
 * Manda il promemoria dovuto a tutti i telefoni iscritti.
 *
 * Senza le chiavi VAPID non si manda niente e non e' un errore: i promemoria
 * sono un di piu', l'app funziona lo stesso.
 */
export async function mandaPromemoria(quando = new Date()): Promise<EsitoInvio> {
  const pubblica = process.env.VAPID_PUBLIC_KEY
  const privata = process.env.VAPID_PRIVATE_KEY

  if (!pubblica || !privata) return { genere: null, mandati: 0, scadute: 0 }

  const genere = await promemoriaDovuto(quando)

  if (!genere) return { genere: null, mandati: 0, scadute: 0 }

  const iscritti = await db().select().from(iscrizioniPush)

  if (iscritti.length === 0) return { genere, mandati: 0, scadute: 0 }

  const webpush = (await import('web-push')).default

  webpush.setVapidDetails(
    process.env.VAPID_CONTATTO ?? 'mailto:nessuno@example.com',
    pubblica,
    privata,
  )

  const corpo = JSON.stringify(TESTI[genere])
  let mandati = 0
  let scadute = 0

  for (const iscritto of iscritti) {
    try {
      await webpush.sendNotification(
        {
          endpoint: iscritto.endpoint,
          keys: { p256dh: iscritto.p256dh, auth: iscritto.auth },
        },
        corpo,
      )
      mandati += 1
    } catch (errore) {
      const stato = (errore as { statusCode?: number }).statusCode

      // 404 e 410: quel telefono non c'e' piu'. La riga si butta, altrimenti
      // ogni giro riprova a bussare a una porta che non esiste.
      if (stato === 404 || stato === 410) {
        await db().delete(iscrizioniPush).where(eq(iscrizioniPush.endpoint, iscritto.endpoint))
        scadute += 1
      } else {
        console.error('promemoria non consegnato:', errore)
      }
    }
  }

  const { data } = adessoARoma(quando)

  await db()
    .insert(promemoriaMandati)
    .values({ genere, data })
    .onConflictDoUpdate({
      target: [promemoriaMandati.genere, promemoriaMandati.data],
      set: { mandatoIl: sql`now()` },
    })

  return { genere, mandati, scadute }
}
