/** Il lunedi' della settimana di una data, in formato YYYY-MM-DD. */
export function lunediDi(data = new Date()): string {
  // Ragioniamo sempre sull'ora di Roma: il server sta altrove.
  const romana = new Date(data.toLocaleString('en-US', { timeZone: 'Europe/Rome' }))
  const giorno = (romana.getDay() + 6) % 7 // 0 = lunedi

  romana.setDate(romana.getDate() - giorno)

  return `${romana.getFullYear()}-${String(romana.getMonth() + 1).padStart(2, '0')}-${String(
    romana.getDate(),
  ).padStart(2, '0')}`
}

export const GIORNI = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
] as const

/** "15 settembre" per il giorno n della settimana che inizia a `inizio`. */
export function dataDelGiorno(inizio: string, giorno: number): string {
  const [anno, mese, giornoMese] = inizio.split('-').map(Number)
  const data = new Date(Date.UTC(anno ?? 1970, (mese ?? 1) - 1, (giornoMese ?? 1) + giorno))

  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(data)
}
