import { MINIMI_KCAL, type Componente, quotaFascia } from './modello'

/**
 * La ricalibrazione dei pasti che restano.
 *
 * Quattro regole, e sono quelle che tengono in piedi la cosa:
 *
 * 1. non si scende sotto il minimo di una fascia: una cena da 200 kcal non e'
 *    una cena, e' un modo per farti mangiare alle undici di sera
 * 2. non si recupera il giorno dopo - qui non se ne occupa nessuno, domani
 *    riparte dall'obiettivo pieno
 * 3. si scala la quantita', non la struttura: i ruoli restano quelli
 * 4. quando c'e' da tagliare, prima i grassi aggiunti, poi la base, e solo
 *    alla fine la proteina
 */

/** L'ordine in cui i ruoli cedono terreno quando il residuo non basta. */
const ORDINE_TAGLIO = ['grasso', 'base', 'snack', 'cereale_colazione', 'spalmabile', 'semi', 'frutta', 'verdura', 'latticino', 'proteina']

export type PastoDaRicalibrare = {
  id: number
  fascia: string
  componenti: Componente[]
  kcalPreviste: number
}

export type EsitoRicalibrazione = {
  pasti: { id: number; componenti: Componente[]; kcal: number }[]
  /** Positivo quando sei sopra l'obiettivo: si dice, non si compensa. */
  sforamento: number
  fattore: number
}

function arrotonda(valore: number): number {
  return Math.max(5, Math.round(valore / 5) * 5)
}

/**
 * Ridistribuisce il residuo del giorno sui pasti che mancano.
 *
 * `residuo` e' obiettivo meno consumato. Quando e' meno della somma dei minimi
 * dei pasti rimasti, si serve il minimo e si dichiara lo sforamento: l'app
 * dice "sei a +340", non toglie la cena.
 */
export function ricalibra(
  rimanenti: PastoDaRicalibrare[],
  residuo: number,
): EsitoRicalibrazione {
  if (rimanenti.length === 0) {
    return { pasti: [], sforamento: Math.max(0, -residuo), fattore: 1 }
  }

  const previsto = rimanenti.reduce((t, p) => t + p.kcalPreviste, 0)
  const minimo = rimanenti.reduce((t, p) => t + (MINIMI_KCAL[p.fascia] ?? quotaFascia(p.fascia)), 0)

  if (previsto <= 0) {
    return { pasti: rimanenti.map((p) => ({ id: p.id, componenti: p.componenti, kcal: 0 })), sforamento: 0, fattore: 1 }
  }

  // Sotto il pavimento non si va: si serve il minimo e si dichiara lo scarto.
  const obiettivoResiduo = Math.max(residuo, minimo)
  const sforamento = Math.max(0, minimo - residuo)
  const fattore = obiettivoResiduo / previsto

  const pasti = rimanenti.map((pasto) => {
    const componenti = scalaComponenti(pasto.componenti, fattore)

    return {
      id: pasto.id,
      componenti,
      kcal: Math.round(pasto.kcalPreviste * fattore),
    }
  })

  return { pasti, sforamento: Math.round(sforamento), fattore }
}

/**
 * Scala i componenti di un pasto.
 *
 * Quando si taglia (fattore < 1) il taglio non e' uniforme: pesa di piu' sui
 * ruoli in cima a ORDINE_TAGLIO e lascia stare la proteina finche' puo'.
 * Quando si aggiunge, invece, si distribuisce in modo uniforme: non ha senso
 * raddoppiare l'olio perche' a pranzo hai mangiato poco.
 */
export function scalaComponenti(componenti: Componente[], fattore: number): Componente[] {
  if (Math.abs(fattore - 1) < 0.05) return componenti

  if (fattore >= 1) {
    return componenti.map((c) => ({ ...c, quantita: arrotonda(c.quantita * Math.min(fattore, 1.5)) }))
  }

  // Il taglio si concentra: chi sta prima nell'ordine cede il doppio.
  const pesi = componenti.map((c) => {
    const posizione = ORDINE_TAGLIO.indexOf(c.ruolo)

    return posizione === -1 ? 1 : 2 - posizione / ORDINE_TAGLIO.length
  })

  const pesoMedio = pesi.reduce((t, p) => t + p, 0) / pesi.length

  return componenti.map((c, i) => {
    const suo = (pesi[i] ?? 1) / pesoMedio
    // Un taglio del 20% diventa 20%*suo, ma mai oltre il 60% del componente.
    const riduzione = Math.min((1 - fattore) * suo, 0.6)

    return { ...c, quantita: arrotonda(c.quantita * (1 - riduzione)) }
  })
}
