/**
 * Le date di una settimana, e come ci si muove dentro.
 *
 * Tutto lavora su stringhe `AAAA-MM-GG`, mai su `Date` che girano per l'app.
 * Non e' pignoleria: una data con dentro un'ora si sposta di un giorno quando
 * cambia l'ora legale, e "che giorno e' oggi" e' esattamente la domanda a cui
 * non puo' rispondere male. I conti si fanno in UTC, dove l'ora legale non
 * esiste, e il fuso serve solo a decidere qual e' oggi - quello lo fa `oggi()`,
 * che guarda l'orologio di Roma.
 *
 * La settimana parte di **lunedi'**, perche' qui e' quella la settimana: la
 * spesa si fa nel fine settimana e il promemoria del giovedi' serve a fare in
 * tempo.
 */

/** Il lunedi' e' il primo giorno: `getUTCDay` invece parte dalla domenica. */
const GIORNI = 7

function aData(data: string): Date {
  const [anno, mese, giorno] = data.split('-').map(Number)

  return new Date(Date.UTC(anno ?? 1970, (mese ?? 1) - 1, giorno ?? 1))
}

function aTesto(data: Date): string {
  return data.toISOString().slice(0, 10)
}

/**
 * Una data che esiste davvero.
 *
 * Il controllo non e' solo sulla forma: serve il giro completo, perche'
 * `2026-02-31` ha la forma giusta e non e' un giorno. Il valore arriva
 * dall'indirizzo, cioe' da chiunque, e una data finta che passa diventa una
 * query con dentro spazzatura.
 */
export function eData(valore: unknown): valore is string {
  if (typeof valore !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valore)) return false

  return aTesto(aData(valore)) === valore
}

/** La data spostata di tanti giorni, avanti o indietro. */
export function sposta(data: string, giorni: number): string {
  const spostata = aData(data)

  spostata.setUTCDate(spostata.getUTCDate() + giorni)

  return aTesto(spostata)
}

/** Il lunedi' della settimana che contiene questa data. */
export function lunediDi(data: string): string {
  // getUTCDay da' 0 per la domenica: +6 e modulo sette la mandano in fondo,
  // che e' il posto che ha nella settimana italiana.
  return sposta(data, -((aData(data).getUTCDay() + 6) % GIORNI))
}

/** I sette giorni della settimana che contiene questa data, da lunedi'. */
export function settimanaDi(data: string): string[] {
  const lunedi = lunediDi(data)

  return Array.from({ length: GIORNI }, (_, i) => sposta(lunedi, i))
}

/** Le iniziali dei giorni, nell'ordine della settimana. */
export const INIZIALI = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const

const MESE_ANNO = new Intl.DateTimeFormat('it-IT', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const GIORNO_LUNGO = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/** "settembre 2026", per la testata del calendario. */
export function meseEAnno(data: string): string {
  return MESE_ANNO.format(aData(data))
}

/** "domenica 20 settembre", sotto il titolo della giornata. */
export function giornoPerEsteso(data: string): string {
  return GIORNO_LUNGO.format(aData(data))
}

/** Il numero del giorno nel mese, per la casella del calendario. */
export function numeroDelMese(data: string): number {
  return aData(data).getUTCDate()
}

/**
 * Prima, oggi o dopo.
 *
 * Serve a decidere cosa si puo' fare in una giornata: una di domani si
 * compone, una di ieri si guarda e basta. Comporre un menu per martedi'
 * scorso non vuol dire niente, e il pulsante non deve nemmeno esserci.
 */
export function quando(data: string, riferimento: string): 'passato' | 'oggi' | 'futuro' {
  if (data === riferimento) return 'oggi'

  return data < riferimento ? 'passato' : 'futuro'
}
