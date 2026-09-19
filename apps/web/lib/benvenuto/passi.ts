/**
 * I passi del benvenuto.
 *
 * Una colonna di dieci schede da compilare la chiudi. Quattro domande alla
 * volta no, e in piu' ogni passo puo' guardare le risposte di quelli prima:
 * e' questo che permette di non mostrare il pesce a chi ha appena detto che
 * il pesce non lo mangia.
 *
 * L'ordine non e' casuale. La salute viene **prima** di cosa togliere perche'
 * una condizione puo' proporre un'esclusione - il glutine con Hashimoto - e
 * una proposta che arriva dopo la domanda non serve a niente: la si legge
 * quando non c'e' piu' la casella da spuntare.
 */
export const PASSI = ['corpo', 'movimento', 'salute', 'togliere'] as const
export type Passo = (typeof PASSI)[number]

export const TITOLO: Record<Passo, string> = {
  corpo: 'Come sei fatto',
  movimento: 'Quanto ti muovi',
  salute: 'Come stai',
  togliere: 'Cosa non mangi',
}

export const SOTTOTITOLO: Record<Passo, string> = {
  corpo: 'Da qui nascono le tue porzioni: senza questi numeri i grammi sarebbero uguali per tutti.',
  movimento: 'Il movimento e l’obiettivo decidono quanto mangi in un giorno.',
  salute: 'Se c’è qualcosa che già sai di te, scrivilo una volta sola: sposta il piano, e cambia la domanda dopo.',
  togliere: 'Quello che spunti qui non comparirà mai: né nei pasti, né fra gli ingredienti da scegliere.',
}

export function ePasso(valore: string): valore is Passo {
  return (PASSI as readonly string[]).includes(valore)
}

/** Il passo dopo, o null quando si e' all'ultimo. */
export function prossimo(passo: Passo): Passo | null {
  return PASSI[PASSI.indexOf(passo) + 1] ?? null
}

export function numeroDi(passo: Passo): number {
  return PASSI.indexOf(passo) + 1
}

/**
 * Quanti passi vede chi si iscrive.
 *
 * Uno in piu' di `PASSI`: la spunta degli ingredienti vive su
 * `/ingredienti/gusti`, ma per chi compila e' l'ultimo passo del benvenuto e
 * nella barra deve contarsi.
 */
export const PASSI_TOTALI = PASSI.length + 1
