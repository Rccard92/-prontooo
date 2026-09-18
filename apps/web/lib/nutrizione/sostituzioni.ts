import type { Nutrienti } from '@prontooo/db/alimenti'

/**
 * Le sostituzioni equivalenti.
 *
 * "Non ho il pollo, ho il merluzzo" e' la domanda vera di ogni sera, e la
 * risposta sbagliata e' 150 g di merluzzo al posto di 150 g di pollo: il
 * merluzzo ha meno proteine, e cambiando a peso si perde mezza porzione senza
 * accorgersene. Quindi si cambia a **nutriente**, non a peso.
 *
 * Quale nutriente comanda dipende dal ruolo che l'alimento copre nel pasto:
 * una proteina si sostituisce a proteine, una base a carboidrati, un grasso a
 * grassi. La verdura si cambia a peso, perche' li' e' il volume che conta.
 */
export type Sostituibile = {
  id: number
  nome: string
  gruppo: string
  ruoli: string[]
  etichette: string[]
  unita: string
  nutrienti: Nutrienti
}

/** Quale nutriente regge la sostituzione, ruolo per ruolo. */
const NUTRIENTE_GUIDA: Record<string, keyof Nutrienti | 'peso'> = {
  proteina: 'proteine',
  latticino: 'proteine',
  base: 'carboidrati',
  cereale_colazione: 'carboidrati',
  frutta: 'carboidrati',
  grasso: 'grassi',
  spalmabile: 'grassi',
  semi: 'grassi',
  snack: 'kcal',
  verdura: 'peso',
}

export type Sostituzione = {
  id: number
  nome: string
  quantita: number
  unita: string
  kcal: number
  /** Quanto si discosta dall'originale sul nutriente guida, in percentuale. */
  scarto: number
  /** L'alimento e' fuori dalla lista degli ingredienti scelti. */
  fuoriLista: boolean
}

function per100(valore: number, quantita: number): number {
  return (valore * quantita) / 100
}

/**
 * La quantita' dell'alternativa che regge lo stesso nutriente dell'originale.
 *
 * Restituisce `null` quando il conto non torna: un alimento con zero grassi
 * non puo' sostituirne uno che serviva per i grassi, e forzarlo darebbe una
 * quantita' infinita.
 */
export function quantitaEquivalente(
  originale: Sostituibile,
  quantita: number,
  alternativa: Sostituibile,
  ruolo: string,
): number | null {
  const guida = NUTRIENTE_GUIDA[ruolo] ?? 'kcal'

  if (guida === 'peso') return Math.max(5, Math.round(quantita / 5) * 5)

  const bersaglio = per100(originale.nutrienti[guida], quantita)
  const densita = alternativa.nutrienti[guida]

  if (bersaglio <= 0 || densita <= 0) return null

  const grezza = (bersaglio / densita) * 100

  // Oltre il triplo o sotto un terzo non e' piu' una sostituzione: e' un
  // altro piatto. Meglio non proporla che proporre 600 g di ricotta.
  if (grezza > quantita * 3 || grezza < quantita / 3) return null

  return Math.max(5, Math.round(grezza / 5) * 5)
}

/**
 * Le alternative a un componente, dalla piu' vicina.
 *
 * `scelti` sono gli alimenti della tua lista: quelli vengono prima, perche'
 * una sostituzione che ti manda a fare la spesa non e' una sostituzione.
 * Le esclusioni sono rigide e valgono anche qui: un alimento escluso non
 * compare mai, nemmeno come alternativa.
 */
export function sostituzioni(
  originale: Sostituibile,
  quantita: number,
  ruolo: string,
  candidati: Sostituibile[],
  scelti: Set<number>,
  esclusioni: string[] = [],
  quante = 6,
): Sostituzione[] {
  const guida = NUTRIENTE_GUIDA[ruolo] ?? 'kcal'
  const bersaglio = guida === 'peso' ? quantita : per100(originale.nutrienti[guida], quantita)

  return candidati
    .filter((c) => c.id !== originale.id)
    // Stesso gruppo: il pollo si cambia con un'altra carne o un altro
    // secondo, non con la marmellata perche' i conti tornano.
    .filter((c) => c.gruppo === originale.gruppo || c.ruoli.includes(ruolo))
    .filter((c) => !esclusioni.some((e) => c.etichette.includes(e)))
    .map((c) => {
      const nuova = quantitaEquivalente(originale, quantita, c, ruolo)

      if (nuova === null) return null

      const reso = guida === 'peso' ? nuova : per100(c.nutrienti[guida], nuova)

      return {
        id: c.id,
        nome: c.nome,
        quantita: nuova,
        unita: c.unita,
        kcal: Math.round(per100(c.nutrienti.kcal, nuova)),
        scarto: bersaglio === 0 ? 0 : Math.round(Math.abs((reso - bersaglio) / bersaglio) * 100),
        fuoriLista: !scelti.has(c.id),
      }
    })
    .filter((s): s is Sostituzione => s !== null)
    .sort((a, b) => {
      if (a.fuoriLista !== b.fuoriLista) return a.fuoriLista ? 1 : -1

      return a.scarto - b.scarto
    })
    .slice(0, quante)
}
