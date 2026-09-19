import type { PostoRicetta } from '@prontooo/db'

/**
 * Da una ricetta del catalogo a una ricetta del ricettario.
 *
 * E' il pezzo che unisce le due meta' dell'app, e vale la pena dire perche'
 * serviva. Una ricetta raccolta da un sito e' un **blocco chiuso**: porta i
 * suoi ingredienti e i suoi grammi. Se la infilo nel piano com'e', o ignoro i
 * suoi grammi - e allora la foto mente sulle porzioni - o ignoro i tuoi, e
 * allora tutto il calcolo su peso, altezza e obiettivo diventa decorazione.
 *
 * Una ricetta del ricettario invece porta **posti**: `{base}`, `{proteina}`,
 * `{verdura}`. I posti li riempiono i componenti del tuo pasto, coi grammi
 * gia' calcolati per te.
 *
 * Qui si fa la conversione. Una volta che la normalizzazione ha detto che
 * "320 g di pasta di semola" e' l'alimento *Pasta di semola*, del gruppo
 * `cereale` e di ruolo `base`, quella riga smette di essere un ingrediente e
 * diventa **il posto della base**. La ricetta si porta dietro la foto e il
 * procedimento veri, e i grammi diventano i tuoi.
 *
 * Il procedimento resta quello della fonte, parola per parola: non ci
 * infiliamo dentro dei segnaposto. "Cuocete la pasta" va bene per 80 g come
 * per 120 - e riscrivere il testo di qualcun altro per far tornare un numero
 * sarebbe un modo di rompere una ricetta che funziona.
 */

/** Un ingrediente della ricetta, dopo che la normalizzazione l'ha riconosciuto. */
export type IngredienteRiconosciuto = {
  /** L'alimento del vocabolario, o null se la riga non e' un alimento. */
  alimentoId: number | null
  nome: string
  gruppo: string | null
  /** Il primo ruolo dell'alimento: quello che il posto si aspetta. */
  ruolo: string | null
  grammi: number | null
  etichette: string[]
  /**
   * Cosa ne ha capito la normalizzazione:
   *
   * - `alimento` - e' nel vocabolario, e diventa un posto
   * - `libero` - sale, basilico, pepe: si scrive e non si pesa
   * - `sconosciuto` - e' un alimento vero che non so tradurre, e **questa e'
   *   la riga che toglie l'attendibilita' alle etichette**
   */
  tipo: 'alimento' | 'libero' | 'sconosciuto'
}

/**
 * I ruoli che possono diventare un posto **obbligatorio**.
 *
 * Il grasso e i semi no: sono il condimento, e una ricetta si fa lo stesso se
 * l'olio lo metti a occhio. Se fossero obbligatori, ogni pasto senza la riga
 * dell'olio risulterebbe "ti manca qualcosa", che e' falso.
 */
const CONDIMENTI = ['grasso', 'semi', 'spalmabile']

/**
 * Quanti posti al massimo. Lo stesso numero dello schema del pasto, e non e'
 * un caso: una ricetta con sei posti non potrebbe mai calzare un piatto che
 * di posti ne ha quattro, e resterebbe per sempre "ti manca qualcosa".
 */
export const POSTI_MASSIMI = 4

/**
 * Sotto due posti non e' una ricetta, e' un alimento.
 *
 * "Mela" non e' una ricetta per la merenda: sarebbe un titolo messo sopra una
 * mela. Il ricettario deve restare fatto di cose che si cucinano.
 */
export const POSTI_MINIMI = 2

export type Conversione = {
  posti: PostoRicetta[]
  /** Le etichette di tutti gli ingredienti riconosciuti, messe insieme. */
  etichette: string[]
  /** Quello che si scrive e non si pesa: sale, aglio, basilico. */
  liberi: string[]
  /**
   * Le etichette si possono garantire?
   *
   * No appena una riga resta sconosciuta: se non so cos'e' la terza riga, non
   * posso giurare che dentro non ci sia glutine. E' la differenza fra "questa
   * ricetta non contiene pesce" e "nelle righe che ho capito non c'e' pesce",
   * e l'app deve poter dire la prima.
   */
  affidabile: boolean
}

/**
 * I posti di una ricetta, dai suoi ingredienti riconosciuti.
 *
 * Un posto per ruolo, e quando due ingredienti coprono lo stesso ruolo vince
 * quello che pesa di piu': in una pasta al pomodoro col basilico, la base e'
 * la pasta, non il pizzico di qualcos'altro. Il peso e' il criterio piu'
 * onesto che abbiamo, perche' e' quello che la fonte ha scritto davvero.
 */
export function converti(ingredienti: IngredienteRiconosciuto[]): Conversione {
  const alimenti = ingredienti.filter((i) => i.tipo === 'alimento' && i.ruolo !== null)
  const liberi = ingredienti.filter((i) => i.tipo === 'libero').map((i) => i.nome)
  const affidabile = !ingredienti.some((i) => i.tipo === 'sconosciuto')

  const perRuolo = new Map<string, IngredienteRiconosciuto>()

  for (const ingrediente of alimenti) {
    const ruolo = ingrediente.ruolo!
    const gia = perRuolo.get(ruolo)

    // A parita' di ruolo comanda chi pesa di piu'. Una riga senza grammi
    // perde contro una che ce li ha, ma vince sul niente.
    if (!gia || (ingrediente.grammi ?? 0) > (gia.grammi ?? 0)) perRuolo.set(ruolo, ingrediente)
  }

  const ordinati = [...perRuolo.entries()].sort(
    ([, a], [, b]) => (b.grammi ?? 0) - (a.grammi ?? 0),
  )

  const posti: PostoRicetta[] = ordinati.slice(0, POSTI_MASSIMI).map(([ruolo, ingrediente]) => ({
    chiave: ruolo,
    ruolo,
    // Il gruppo resta stretto: una ricetta di pesce non deve accettare il
    // manzo solo perche' copre lo stesso ruolo. E' la stessa regola che
    // `abbina` applica ai posti scritti a mano.
    gruppi: ingrediente.gruppo === null ? [] : [ingrediente.gruppo],
    ...(CONDIMENTI.includes(ruolo) ? { facoltativo: true } : {}),
  }))

  const obbligatori = posti.filter((p) => !p.facoltativo)

  return {
    // Meno di due posti veri non e' una ricetta: e' un alimento con un titolo
    // sopra, e nel ricettario non ci deve entrare.
    posti: obbligatori.length >= POSTI_MINIMI ? posti : [],
    etichette: [...new Set(alimenti.flatMap((i) => i.etichette))].sort(),
    liberi,
    affidabile,
  }
}
