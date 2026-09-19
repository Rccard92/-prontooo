import type { Etichetta } from '@prontooo/db/alimenti'

import { ESCLUSIONI } from './impostazioni'

/**
 * La via di mezzo fra "mangio tutto" e "togli per sempre".
 *
 * Le esclusioni sono rigide e devono restarlo: chi ha un'allergia non vuole
 * sfumature. Ma fra l'allergia e il niente c'e' il caso piu' comune di tutti,
 * e finora l'app non lo sapeva dire.
 *
 * Due esempi veri, e sono i due che esistono qui dentro:
 *
 * - **Il glutine.** Gli esami dicono che non sei celiaco, ma quando esageri
 *   con pasta e pane stai gonfio per ore. Togliere il glutine ti farebbe
 *   vivere da celiaco senza esserlo - e pure peggio, perche' senza la
 *   diagnosi nessuno controlla che la dieta resti completa. Quello che serve
 *   e' **meno carico**: una sola fonte per pasto e non a tutti i pasti.
 * - **Il lattosio.** Togliere il lattosio toglie la mozzarella, e non e'
 *   quello che vuoi: la mozzarella senza lattosio esiste, sta al banco
 *   accanto. Qui non si toglie niente, si **sostituisce**.
 *
 * Sono due meccaniche diverse e non vanno confuse, per questo il modo sta
 * scritto sull'attenuazione invece di essere dedotto.
 */
export type Modo = 'riduci' | 'sostituisci'

export type Attenuazione = {
  etichetta: Etichetta
  nome: string
  modo: Modo
  /** Cosa fa davvero al piano, detto in una riga. */
  cosaFa: string
  /** Quanto si sa, senza vendere certezze che non ci sono. */
  quantoSiSa: string
}

export const ATTENUAZIONI: Attenuazione[] = [
  {
    etichetta: 'glutine',
    nome: 'Meno glutine, senza toglierlo',
    modo: 'riduci',
    cosaFa:
      'Una sola fonte di glutine per pasto - o la pasta o il pane, non tutti e due - e non a tutti i pasti della giornata.',
    quantoSiSa:
      'La sensibilita’ al glutine non celiaca esiste: in uno studio in doppio cieco il 44% di chi la lamentava e’ peggiorato col glutine somministrato di nascosto. Ma si sospetta che in molti casi il colpevole non sia il glutine, siano i fruttani del grano - che e’ anche il motivo per cui ridurre funziona spesso meglio che eliminare.',
  },
  {
    etichetta: 'lattosio',
    nome: 'Latticini senza lattosio',
    modo: 'sostituisci',
    cosaFa:
      'Non toglie il latticino dal piatto: quando esiste la versione senza lattosio, il piano propone quella.',
    quantoSiSa:
      'L’intolleranza al lattosio e’ una cosa misurata, non un’opinione: manca l’enzima. Ma e’ una questione di dose, e i formaggi stagionati ne hanno pochissimo di loro - per questo togliere tutti i latticini e’ quasi sempre piu’ di quello che serve.',
  },
]

export function attenuazione(etichetta: string): Attenuazione | null {
  return ATTENUAZIONI.find((a) => a.etichetta === etichetta) ?? null
}

/** Le etichette che hai messo in questo modo. Il resto dell'app chiede qui. */
export function attive(attenuazioni: string[], modo: Modo): Etichetta[] {
  return ATTENUAZIONI.filter((a) => a.modo === modo && attenuazioni.includes(a.etichetta)).map(
    (a) => a.etichetta,
  )
}

/**
 * Un'attenuazione su un'etichetta che escludi non ha senso: l'esclusione ha
 * gia' tolto tutto, e non c'e' piu' niente da ridurre o sostituire. Vince
 * l'esclusione, che e' la scelta piu' netta delle due.
 */
export function senzaLeEscluse(attenuazioni: string[], esclusioni: string[]): string[] {
  return attenuazioni.filter((a) => !esclusioni.includes(a))
}

/**
 * Quante volte al giorno il glutine puo' comparire, per chi lo riduce.
 *
 * Due pasti su cinque. Non e' un numero preso a caso: pane a colazione e
 * pasta a pranzo sono la giornata italiana normale, e il carico che da'
 * fastidio comincia quando si aggiunge anche la cena. Togliere il terzo e'
 * la riduzione vera; togliere tutti e tre sarebbe far vivere da celiaco chi
 * non lo e'.
 */
export const PASTI_CON_GLUTINE = 2

/**
 * Le voci senza quell'etichetta - ma solo se ne resta qualcuna.
 *
 * E' la differenza fra ridurre e togliere, ed e' tutta qui. Se nella tua
 * lista l'unica base di quel pasto porta glutine, il pasto lo fa lei: meglio
 * il pane per la terza volta che un pranzo senza base. Chi vuole lo zero
 * assoluto ha le esclusioni, che sono rigide apposta.
 */
export function preferiSenza<T>(voci: T[], porta: (voce: T) => boolean): T[] {
  const pulite = voci.filter((v) => !porta(v))

  return pulite.length > 0 ? pulite : voci
}

/**
 * Cosa ha scelto la persona nella sezione "cosa togliere".
 *
 * Sta qui e non nelle due azioni che la chiamano perche' la domanda ha due
 * forme - una casella per quasi tutte le etichette, tre risposte per quelle
 * che hanno una via di mezzo - e leggerla in due posti vuol dire prima o poi
 * leggerla in due modi.
 *
 * Prende un lettore invece di una `FormData` cosi' si prova senza fingere un
 * form.
 */
export function leggiCosaTogliere(valore: (campo: string) => string | null): {
  esclusioni: Etichetta[]
  attenuazioni: Etichetta[]
} {
  const esclusioni: Etichetta[] = []
  const attenuazioni: Etichetta[] = []

  for (const e of ESCLUSIONI) {
    if (attenuazione(e.id)) {
      const modo = valore(`modo-${e.id}`)

      if (modo === 'togli') esclusioni.push(e.id)
      else if (modo === 'attenua') attenuazioni.push(e.id)

      continue
    }

    if (valore(`esclusione-${e.id}`) === 'si') esclusioni.push(e.id)
  }

  return { esclusioni, attenuazioni }
}
