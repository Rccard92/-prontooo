import { normalizza } from '../lista/pdf'

/**
 * Da "PETTO DI POLLO AIA 500g" a "Petto di pollo", con quanto ci crediamo.
 *
 * Qui non basta agganciare: bisogna sapere **quanto** l'aggancio vale. Un
 * prezzo sbagliato mostrato come sicuro e' peggio di nessun prezzo, e il nome
 * su un volantino e' pieno di marca, formato e aggettivi da reparto.
 *
 * La regola di base: quanto del nome dell'alimento e' dentro il nome
 * dell'offerta, e quanto del nome dell'offerta e' spiegato dall'alimento. Il
 * secondo pezzo serve a scartare "Gelato al pistacchio" per "Pistacchi".
 */

export const SOGLIA_CERTA = 0.72

/** Parole di volantino che non dicono niente sul prodotto. */
const RIEMPITIVI = new Set([
  'confezione',
  'conf',
  'busta',
  'vaschetta',
  'vassoio',
  'astuccio',
  'barattolo',
  'bottiglia',
  'brik',
  'sacchetto',
  'offerta',
  'nuovo',
  'nuova',
  'classico',
  'classica',
  'gusto',
  'gusti',
  'assortito',
  'assortiti',
  'assortite',
  'vari',
  'varie',
  'italiano',
  'italiana',
  'italia',
  'origine',
  'selezione',
  'qualita',
  'extra',
  'primo',
  'prima',
  'fresco',
  'fresca',
  'freschi',
  'fresche',
  'surgelato',
  'surgelata',
  'refrigerato',
  'sottovuoto',
  'kg',
  'gr',
  'ml',
  'lt',
  'pz',
  'pezzi',
  'circa',
  'peso',
  'variabile',
])

function parole(testo: string): string[] {
  return normalizza(testo)
    .split(' ')
    .filter((p) => p.length > 2 && !RIEMPITIVI.has(p) && !/^\d+$/.test(p))
}

export type Aggancio = { alimentoId: number; confidenza: number }

/**
 * L'alimento che quest'offerta compra, e quanto ci crediamo.
 *
 * `null` quando nessun alimento arriva alla soglia minima: meglio un'offerta
 * senza aggancio che un'offerta agganciata male.
 */
export function agganciaOfferta(
  nomeOfferta: string,
  alimenti: { id: number; nome: string }[],
): Aggancio | null {
  const dellOfferta = parole(nomeOfferta)

  if (dellOfferta.length === 0) return null

  const insieme = new Set(dellOfferta)

  const punteggi = alimenti
    .map((alimento) => {
      const sue = parole(alimento.nome)

      if (sue.length === 0) return { alimentoId: alimento.id, confidenza: 0 }

      const comuni = sue.filter((p) => insieme.has(p))

      if (comuni.length === 0) return { alimentoId: alimento.id, confidenza: 0 }

      // Quanto dell'alimento e' coperto: "petto pollo" tutto dentro -> 1.
      const copertura = comuni.length / sue.length
      // Quanto dell'offerta e' spiegato: tiene lontano "gelato pistacchio".
      const pertinenza = comuni.length / dellOfferta.length

      // La copertura pesa il doppio: il nome del volantino ha sempre parole
      // in piu' - marca, formato, reparto - e sarebbe ingiusto punirlo.
      let confidenza = (copertura * 2 + pertinenza) / 3

      // Il nome dell'alimento scritto per intero, di fila, e' quasi certezza.
      if (normalizza(nomeOfferta).includes(normalizza(alimento.nome))) {
        confidenza = Math.max(confidenza, 0.9)
      }

      // Una parola sola in comune, e generica, non fa un aggancio.
      if (comuni.length === 1 && sue.length > 1) confidenza = Math.min(confidenza, 0.6)

      return { alimentoId: alimento.id, confidenza: Math.round(confidenza * 100) / 100 }
    })
    .filter((x) => x.confidenza >= 0.45)
    .sort((a, b) => b.confidenza - a.confidenza)

  const migliore = punteggi[0]

  if (!migliore) return null

  // Due alimenti a pari merito: non sappiamo quale, e non si tira a indovinare.
  const secondo = punteggi[1]

  if (secondo && secondo.confidenza === migliore.confidenza) {
    return { ...migliore, confidenza: Math.min(migliore.confidenza, 0.6) }
  }

  return migliore
}

/** Sotto soglia l'offerta si mostra come "da verificare", mai come certa. */
export function eCerta(confidenza: number, confermato = false): boolean {
  return confermato || confidenza >= SOGLIA_CERTA
}
