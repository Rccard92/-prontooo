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
  [/torte salate|torta salata|rustici|quiche|sformat/, 'secondo'],
  [/piatti unici|piatto unico|one pot/, 'piatto_unico'],
  [
    /primi piatti|\bprimi\b|paste|\bpasta\b|risott|zupp|minestr|gnocchi|lasagne|vellutat|spaghett|penne|rigatoni|paccheri|tagliatelle|fusilli|orecchiette|ravioli|tortell|cannelloni|couscous|farro|orzott/,
    'primo',
  ],
  [
    /secondi piatti|\bsecondi\b|carne|pesce|uova e frittate|frittat|spezzatin|polpett|cotolett|scaloppin|arrost|brasat|straccett|hamburger|pollo|tacchino|manzo|vitello|maiale|agnello|coniglio|cinghiale|salmone|merluzzo|tonno|orata|branzino|gamber|calamar|cozze|vongole|seppie|polpo|baccal|stracotto|coda alla|spiedini/,
    'secondo',
  ],
  [/antipasti|antipasto|finger food|stuzzichini|aperitivo|crostin|bruschett/, 'antipasto'],
  [/contorni|contorno|insalat|verdure|patate al forno|puree/, 'contorno'],
  [/lievitati|\bpane\b|pizze|\bpizza\b|focacc|brioche|croissant|cornetti|panini/, 'lievitato'],
  [
    /dolci|dolce|dessert|tort|crostat|biscott|budin|gelat|creme|marmellate|muffin|cheesecake|tiramis|panna cotta|frittelle dolci|ciambell|plumcake|pastiera|aspic/,
    'dolce',
  ],
  [/bevande|cocktail|drink|smoothie|centrifugat/, 'bevanda'],
  [/colazione|merenda/, 'lievitato'],
]

/**
 * I ruoli che il catalogo raccoglie.
 *
 * Solo quelli che possono reggere un pranzo o una cena. Fuori restano i dolci
 * - scelta esplicita: la colazione l'app la compone dai tuoi alimenti, e un
 * catalogo di crostate costava soldi da leggere per ricette che il piano non
 * avrebbe proposto mai - e con loro i lievitati, gli antipasti, i contorni e
 * le bevande, che un pasto da soli non lo fanno.
 *
 * Il primo giro vero l'ha reso evidente: su cento ricette lette, tredici
 * entravano nel piano, e quasi tutte le altre erano torte. Il difetto non era
 * nel leggerle, era nel raccoglierle.
 */
export const RUOLI_IN_CATALOGO: Ruolo[] = ['primo', 'secondo', 'piatto_unico']

/** Questa ricetta puo' finire in catalogo, o e' roba che il piano non usa? */
export function daTenereInCatalogo(ruolo: Ruolo | null): boolean {
  return ruolo !== null && RUOLI_IN_CATALOGO.includes(ruolo)
}

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
export function classifica(
  categoria: string | null,
  url: string,
  titolo: string | null = null,
): Classificazione {
  // Anche il **titolo**, e non e' un dettaglio. Il sondaggio di Cookaround
  // l'ha reso evidente: i loro indirizzi sono `/ricetta/nome.html`, senza la
  // sezione nel percorso, e se la fonte non dichiara la categoria restava
  // solo il nulla. Cosi' "Cotolette di cinghiale" e "Zuppa rustica" - un
  // secondo e un primo - finivano fra le non classificabili e venivano
  // scartate dal catalogo. Il titolo invece c'e' sempre.
  const testo = [categoria ?? '', percorso(url), titolo ?? ''].join(' ').toLowerCase()

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
