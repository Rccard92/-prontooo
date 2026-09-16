/**
 * Da che categoria scrive la fonte, a che cosa serve la ricetta.
 *
 * E' il pezzo che fa funzionare "cambia ricetta": se sostituisci un primo
 * deve arrivare un altro primo, e a colazione non puo' spuntare l'arrosto.
 * I siti italiani usano quasi tutti lo stesso vocabolario di categorie, quindi
 * si risolve con una tabella - nessun modello, nessun costo.
 */

export const FASCE = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'] as const
export type Fascia = (typeof FASCE)[number]

export const RUOLI = [
  'primo',
  'secondo',
  'piatto_unico',
  'antipasto',
  'contorno',
  'dolce',
  'lievitato',
  'bevanda',
] as const
export type Ruolo = (typeof RUOLI)[number]

/** In quali fasce puo' finire una ricetta, dato il suo ruolo nel pasto. */
const FASCE_PER_RUOLO: Record<Ruolo, Fascia[]> = {
  primo: ['pranzo', 'cena'],
  secondo: ['pranzo', 'cena'],
  piatto_unico: ['pranzo', 'cena'],
  dolce: ['colazione', 'merenda'],
  lievitato: ['colazione', 'merenda', 'spuntino'],
  // Antipasti, contorni e bevande stanno in catalogo ma non reggono un pasto
  // da soli: il piano non li pesca mai come piatto principale.
  antipasto: [],
  contorno: [],
  bevanda: [],
}

/**
 * Le parole che compaiono nelle categorie e negli indirizzi dei siti italiani.
 * L'ordine conta: si ferma alla prima che trova, quindi le piu' specifiche
 * stanno prima. "torte salate" deve battere "torte".
 */
const INDIZI: [RegExp, Ruolo][] = [
  [/torte salate|rustici|quiche/, 'secondo'],
  [/piatti unici|piatto unico|one pot/, 'piatto_unico'],
  [/primi piatti|\bprimi\b|paste|\bpasta\b|risotti|risotto|zuppe|minestre|gnocchi|lasagne/, 'primo'],
  [/secondi piatti|\bsecondi\b|carne|pesce|uova e frittate|frittate|spezzatin/, 'secondo'],
  [/antipasti|antipasto|finger food|stuzzichini|aperitivo/, 'antipasto'],
  [/contorni|contorno|insalate|verdure/, 'contorno'],
  [/lievitati|pane|pizze|\bpizza\b|focacce|brioche|croissant|cornetti/, 'lievitato'],
  [/dolci|dolce|dessert|torte|crostate|biscotti|budini|gelati|creme|marmellate/, 'dolce'],
  [/bevande|cocktail|drink|smoothie|centrifugat/, 'bevanda'],
  [/colazione|merenda/, 'lievitato'],
]

export type Classificazione = {
  ruolo: Ruolo | null
  fasce: Fascia[]
}

/**
 * Classifica una ricetta dalla categoria dichiarata dalla fonte e, se quella
 * non basta, dall'indirizzo: quasi tutti i siti mettono la sezione nel percorso
 * (`/ricette/primi-piatti/...`).
 *
 * Ruolo nullo vuol dire che non l'abbiamo capito: la ricetta entra in catalogo
 * ma il piano non la usa, perche' proporre un contorno come cena e' peggio che
 * non proporre niente.
 */
export function classifica(categoria: string | null, url: string): Classificazione {
  const testo = [categoria ?? '', percorso(url)].join(' ').toLowerCase()

  for (const [indizio, ruolo] of INDIZI) {
    if (indizio.test(testo)) {
      return { ruolo, fasce: FASCE_PER_RUOLO[ruolo] }
    }
  }

  return { ruolo: null, fasce: [] }
}

function percorso(url: string): string {
  try {
    return new URL(url).pathname.replace(/[-_/]+/g, ' ')
  } catch {
    return ''
  }
}

/** Il nome della fascia come si scrive nella UI. */
export const NOME_FASCIA: Record<Fascia, string> = {
  colazione: 'Colazione',
  spuntino: 'Spuntino',
  pranzo: 'Pranzo',
  merenda: 'Merenda',
  cena: 'Cena',
}

export function eFascia(valore: string): valore is Fascia {
  return (FASCE as readonly string[]).includes(valore)
}
