/**
 * Il vocabolario degli alimenti e i ruoli che coprono dentro un pasto.
 *
 * E' il pezzo che sostituisce "pesca una ricetta a caso e sperem": un pasto si
 * compone di ruoli - la base, la proteina, la verdura, il grasso - e ogni ruolo
 * si riempie con un alimento ammesso, con il suo peso.
 */

export const GRUPPI = [
  'cereale',
  'tubero',
  'pane',
  'legume',
  'carne',
  'pesce',
  'uova',
  'latticino',
  'verdura',
  'frutta',
  'grasso',
  'frutta_secca',
  'dolce',
  'bevanda',
] as const
export type Gruppo = (typeof GRUPPI)[number]

/** Il posto che un alimento occupa dentro uno schema di pasto. */
export const RUOLI_PASTO = [
  'base',
  'proteina',
  'verdura',
  'grasso',
  'frutta',
  'latticino',
  'cereale_colazione',
  'spalmabile',
  'semi',
  'snack',
] as const
export type RuoloPasto = (typeof RUOLI_PASTO)[number]

export const FASCE_PASTO = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'] as const
export type FasciaPasto = (typeof FASCE_PASTO)[number]

/**
 * Le etichette che fanno scattare le esclusioni del profilo. Sono attributi
 * dell'alimento, non della ricetta: e' l'unico modo per poterle rispettare
 * davvero.
 */
export const ETICHETTE = [
  'lattosio',
  'glutine',
  'pane',
  'maiale',
  'carne_rossa',
  'pesce',
  'uova',
  'frutta_guscio',
  'fritto',
  'proteico',
  'zuccheri',
] as const
export type Etichetta = (typeof ETICHETTE)[number]

export type VoceAlimento = {
  nome: string
  gruppo: Gruppo
  ruoli: RuoloPasto[]
  fasce: FasciaPasto[]
  /** Quantita' tipica di una porzione singola. */
  quantita: number
  unita: 'g' | 'ml'
  etichette?: Etichetta[]
  /**
   * I mesi in cui ha senso comprarlo, 1-12. Vuoto vuol dire sempre.
   *
   * Non si scrive qui voce per voce: sta in `stagioni.ts`, dove si legge
   * tutta insieme e si corregge guardando l'anno intero.
   */
  mesi?: number[]
  /**
   * Si mangia, ma il piano non lo propone come voce fissa.
   *
   * Non si scrive qui voce per voce: sta in `occasionali.ts`.
   */
  occasionale?: boolean
}

/** Il reparto del supermercato: ordina la lista della spesa sul percorso fisico. */
export const REPARTI = [
  'ortofrutta',
  'macelleria',
  'pescheria',
  'frigo',
  'panetteria',
  'surgelati',
  'dispensa',
] as const
export type Reparto = (typeof REPARTI)[number]

export const NOME_REPARTO: Record<Reparto, string> = {
  ortofrutta: 'Ortofrutta',
  macelleria: 'Carne',
  pescheria: 'Pesce',
  frigo: 'Banco frigo',
  panetteria: 'Panetteria',
  surgelati: 'Surgelati',
  dispensa: 'Dispensa',
}
