/**
 * Chi puo' restare nel piatto quando il lattosio da' fastidio.
 *
 * Togliere l'etichetta `lattosio` toglie trentacinque alimenti, fra cui la
 * mozzarella - e non e' quello che vuole quasi nessuno. La mozzarella senza
 * lattosio esiste e sta al banco accanto: il piano deve dire **quella**, non
 * far sparire la caprese.
 *
 * Quindi qui dentro ci sono due liste e fanno due cose diverse:
 *
 * 1. `SENZA_LATTOSIO` - i latticini che al supermercato hanno il gemello
 *    delattosato. Il piano scambia il nome e tiene i grammi.
 * 2. `POCO_LATTOSIO` - gli stagionati. Non serve nessun gemello: durante la
 *    stagionatura il lattosio se lo mangiano i batteri, e in trenta grammi di
 *    grana ne resta una traccia. Toglierli sarebbe togliere per niente.
 *
 * Quello che non sta in nessuna delle due - la burrata, il gelato, lo yogurt
 * da bere probiotico - il piano lo lascia fuori, perche' li' il lattosio c'e'
 * davvero e al banco un'alternativa non c'e'.
 *
 * Il gemello deve coprire lo **stesso ruolo** dell'originale, e un test lo
 * controlla: sostituire una mozzarella con uno yogurt non e' una sostituzione,
 * e' un buco al posto della proteina su cui si reggeva il piatto.
 *
 * Vale solo per chi ha scelto di **attenuare**. Chi esclude il lattosio lo
 * esclude e basta: l'esclusione resta rigida, e non la addolcisce nessuno.
 */
export const SENZA_LATTOSIO: Record<string, string> = {
  Mozzarella: 'Mozzarella senza lattosio',
  'Latte intero': 'Latte senza lattosio',
  'Yogurt bianco intero': 'Yogurt bianco senza lattosio',
  'Yogurt greco 0%': 'Yogurt greco senza lattosio',
  'Yogurt greco 5%': 'Yogurt greco senza lattosio',
  'Ricotta vaccina': 'Ricotta senza lattosio',
  'Ricotta spalmabile': 'Ricotta senza lattosio',
  'Fiocchi di latte': 'Yogurt greco senza lattosio',
  Kefir: 'Yogurt bianco senza lattosio',
  Skyr: 'Yogurt greco senza lattosio',
}

/** Stagionati: il lattosio lo consuma la stagionatura, e restano dove sono. */
export const POCO_LATTOSIO: string[] = [
  'Grana Padano',
  'Pecorino',
  'Caciocavallo',
  'Provola',
  'Scamorza affumicata',
  'Fontina',
  'Gorgonzola',
  'Cheddar',
  'Burro',
]

export type EsitoLattosio = 'sostituisci' | 'tieni' | 'togli'

/**
 * Cosa farne, per chi ha scelto di attenuare invece di escludere.
 *
 * `tieni` anche per chi non ha l'etichetta: la decisione su quale alimento
 * porta lattosio sta nel vocabolario, non qui.
 */
export function cheFarneCol(nome: string, etichette: readonly string[]): EsitoLattosio {
  if (!etichette.includes('lattosio')) return 'tieni'
  if (POCO_LATTOSIO.includes(nome)) return 'tieni'

  return SENZA_LATTOSIO[nome] ? 'sostituisci' : 'togli'
}
