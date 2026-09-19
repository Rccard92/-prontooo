/**
 * Quello che si mangia, ma che un piano non ti propone tutte le settimane.
 *
 * La domanda era giusta: che ci fa la mortadella fra gli ingredienti di una
 * dieta? La risposta non e' toglierla. Se la mortadella non esiste nel
 * vocabolario non puoi **registrare** il panino che hai mangiato davvero, e
 * lo storico - che serve a capire dove caschi - diventa una bugia gentile.
 *
 * Quindi restano, ma cambiano peso. Un alimento occasionale si puo' spuntare,
 * si puo' registrare, e ogni tanto esce anche nel piano: quello che non fa e'
 * comparire come la proteina fissa del martedi'. Il peso basso dice proprio
 * questo, "ogni tanto", che e' il posto giusto per una salsiccia.
 *
 * La riga di taglio: lo metterebbe un nutrizionista in un piano settimanale?
 * Il salmone si', anche se e' grasso. La brioche no, anche se e' buona.
 */
export const OCCASIONALI: string[] = [
  // Salumi grassi: il prosciutto e la bresaola no, questi si'.
  'Salsiccia',
  'Mortadella',
  'Speck',

  // Condimenti che nei piani italiani non sono il default.
  'Maionese',
  'Burro',

  // Fritto e impanato.
  'Cotoletta di pollo',

  // Latticini molto grassi: la mozzarella resta ordinaria, questi no.
  'Burrata',
  'Stracciatella vaccina',

  // Lievitati e pizza: si mangiano, non si programmano tre volte a settimana.
  'Pizza margherita',
  'Focaccia',

  // Dolci veri. Il cioccolato fondente e il miele restano fuori da qui:
  // in dosi piccole stanno in tantissimi piani.
  'Cornetto',
  'Brioche col tuppo',
  'Gelato',
  'Granita siciliana',
  'Muffin',
  'Plumcake',
  'Torta fatta in casa',
  'Biscotti secchi',
]

const INSIEME = new Set(OCCASIONALI)

export function eOccasionale(nome: string): boolean {
  return INSIEME.has(nome)
}
