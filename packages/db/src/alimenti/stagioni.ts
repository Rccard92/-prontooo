/**
 * In che mesi ha senso comprare una cosa.
 *
 * Vale per frutta e verdura e per nient'altro: la pasta non ha stagione, e
 * mettere dodici mesi accanto a ogni scatoletta sarebbe solo rumore. Chi non
 * compare qui dentro e' disponibile sempre.
 *
 * I mesi sono 1-12 e gli intervalli possono passare per il capodanno: le
 * arance vanno da novembre ad aprile, e `[11, 12, 1, 2, 3, 4]` e' esattamente
 * quello che si intende.
 *
 * Due scelte da spiegare, perche' non sono ovvie:
 *
 * - quello che arriva da lontano tutto l'anno - banane, ananas, limoni - non
 *   ha stagione **qui**, e fingere che ce l'abbia non aiuterebbe nessuno
 * - quello che si conserva bene per mesi - mele, patate, cipolle, carote -
 *   conta come sempre disponibile, perche' al banco c'e' davvero sempre
 *
 * La regola vera che questa tabella serve: a gennaio non si mangiano le
 * pesche. Non per moda, ma perche' una pesca a gennaio ha attraversato mezzo
 * mondo o una serra, e in una dieta fatta bene la frutta segue l'anno.
 */

/** Da mese a mese, passando per dicembre quando serve. */
function da(primo: number, ultimo: number): number[] {
  const mesi: number[] = []

  let mese = primo

  for (let i = 0; i < 12; i += 1) {
    mesi.push(mese)

    if (mese === ultimo) break

    mese = mese === 12 ? 1 : mese + 1
  }

  return mesi
}

export const STAGIONI: Record<string, number[]> = {
  // ---------- Frutta ----------
  Albicocche: da(6, 8),
  Anguria: da(6, 9),
  Arance: da(11, 4),
  "Spremuta d'arancia": da(11, 4),
  Cachi: da(10, 12),
  Castagne: da(9, 11),
  Ciliegie: da(5, 7),
  Clementine: da(11, 2),
  Fichi: da(8, 9),
  Fragole: da(4, 6),
  Kiwi: da(11, 4),
  Lamponi: da(6, 9),
  Mandarini: da(11, 2),
  Melone: da(6, 9),
  Mirtilli: da(6, 9),
  More: da(7, 9),
  Nespole: da(4, 5),
  Pera: da(8, 2),
  Pesche: da(6, 9),
  Pompelmo: da(11, 4),
  Melagrana: da(10, 12),
  Ribes: da(6, 8),
  Prugne: da(7, 9),
  Uva: da(8, 10),

  // ---------- Verdura ----------
  Agretti: da(3, 5),
  Asparagi: da(3, 6),
  Barbabietola: da(9, 3),
  Broccoli: da(10, 4),
  Carciofi: da(11, 5),
  Cavolfiore: da(10, 4),
  'Cavolo cappuccio': da(10, 3),
  'Cavolo nero': da(10, 3),
  Rape: da(10, 3),
  Cetrioli: da(5, 9),
  Cicoria: da(9, 5),
  'Cime di rapa': da(11, 4),
  Fagiolini: da(6, 9),
  Fave: da(4, 6),
  Finocchi: da(10, 4),
  Funghi: da(9, 11),
  Indivia: da(10, 4),
  Melanzane: da(6, 10),
  Peperoni: da(6, 10),
  Pomodori: da(6, 9),
  Pomodorini: da(6, 9),
  Porri: da(10, 4),
  Puntarelle: da(11, 3),
  Radicchio: da(10, 3),
  Ravanelli: da(3, 10),
  'Cavolini di Bruxelles': da(10, 3),
  'Sedano rapa': da(10, 3),
  Cipollotto: da(3, 6),
  Scarola: da(10, 4),
  Spinaci: da(10, 4),
  Taccole: da(4, 6),
  Valeriana: da(10, 4),
  Verza: da(10, 3),
  Zucca: da(9, 12),
  'Fiori di zucca': da(6, 9),
  Topinambur: da(10, 3),
  Zucchine: da(5, 9),
}

/** I mesi di un alimento. Vuoto vuol dire "sempre". */
export function mesiDi(nome: string): number[] {
  return STAGIONI[nome] ?? []
}

/** Il mese a Roma, 1-12: le stagioni sono quelle di qui, non quelle del server. */
export function meseCorrente(quando = new Date()): number {
  return new Date(quando.toLocaleString('en-US', { timeZone: 'Europe/Rome' })).getMonth() + 1
}

/** E' di stagione adesso? Senza mesi dichiarati, sempre si'. */
export function diStagione(mesi: number[], mese = meseCorrente()): boolean {
  return mesi.length === 0 || mesi.includes(mese)
}
