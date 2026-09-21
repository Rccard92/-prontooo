import type { Alimento } from '@prontooo/db'

import type { Componente } from './modello'

/**
 * Le dosi del piatto, non quelle della ricetta.
 *
 * Questo file esiste per un pranzo vero che l'app ha messo in tavola: pasta
 * col pesto, 30 g di olio, e tre formaggi grattugiati da 5 g l'uno. Nessuno
 * dei due numeri e' un errore di calcolo - sono esattamente quello che c'era
 * scritto nella ricetta, ridotto in proporzione. Ed e' li' il problema.
 *
 * Una ricetta di un sito di cucina e' scritta per far venire buono il piatto,
 * non per far tornare la tua giornata. L'olio e' abbondante perche' l'olio fa
 * buono, e nessuno che cucina lo pesa. Scalare in proporzione conserva la
 * verita' della ricetta - ed e' per questo che si scala - ma conserva anche
 * le sue esagerazioni: un piatto in cui meta' delle calorie e' condimento
 * resta meta' condimento anche quando diventa piccolo.
 *
 * La regola che scioglie il nodo e' una sola, e viene dal vocabolario:
 *
 *   **ogni alimento ha gia' scritto quanto e' una sua porzione.**
 *
 * 10 g di olio, 80 g di pasta, 30 g di parmigiano. Sono numeri che stanno in
 * `packages/db/src/alimenti/vocabolario.ts` da sempre e che finora servivano
 * solo a comporre i pasti dalla lista. Qui diventano il metro: la ricetta
 * dice **cosa** c'e' dentro, il vocabolario dice **quanto** ne va in un
 * piatto. La prima cosa non si tocca mai, la seconda e' nostra.
 *
 * Cosi' la ricetta resta se stessa - stessi ingredienti, stesso titolo,
 * stessa foto, nessuno scambio - e le dosi diventano quelle di chi mangia.
 */

/**
 * Quante volte la porzione di riferimento puo' pesare un ingrediente.
 *
 * Due numeri e non venti, perche' il tetto non serve a tarare ogni alimento:
 * serve a fermare le esagerazioni. Su quasi tutto sta largo apposta - 2,5
 * volte la porzione vuol dire che scatta solo quando la ricetta e' davvero
 * fuori scala, e una ricetta abbondante resta abbondante.
 *
 * I grassi aggiunti stanno stretti perche' sono l'unico posto dove tutte le
 * ricette sbandano nella stessa direzione: l'olio "a filo" di chi scrive e'
 * il doppio di quello di chi legge, e a 9 kcal al grammo il doppio si vede
 * subito. I dolci - zucchero, cioccolato, miele - stanno stretti per lo
 * stesso motivo.
 */
const TETTI: Record<string, number> = { grasso: 1.5, dolce: 1.5, frutta_secca: 1.8 }
const TETTO = 2.5

/**
 * I gruppi tenuti stretti, che sono anche quelli su cui le calorie non
 * tornano mai.
 *
 * Le due cose vanno insieme per forza: ridistribuire su un gruppo che abbiamo
 * appena limitato vuol dire rimetterci dentro quello che avevamo tolto,
 * magari da un altro ingrediente dello stesso tipo. Togliere l'olio per
 * mettere piu' pistacchi non e' un piatto piu' equilibrato, e' lo stesso
 * piatto con un'altra faccia.
 */
const STRETTI = new Set(Object.keys(TETTI))

/**
 * I gruppi che possono diventare "q.b." invece di un peso.
 *
 * Sotto un certo grammo un numero e' peggio di nessun numero: "Pecorino 5 g"
 * ti fa comprare, pesare e sporcare una bilancia per un cucchiaino, e sembra
 * anche una precisione che non abbiamo. "Pecorino q.b." e' la stessa cosa
 * detta come la direbbe una persona.
 *
 * Non ci sono la pasta, il pane, la carne, il pesce, le uova e i legumi: sono
 * gli ingredienti su cui il piatto si regge, e quelli si pesano. Se il conto
 * li fa venire minuscoli il difetto sta altrove, e nasconderlo dietro un
 * "q.b." lo renderebbe solo piu' difficile da vedere.
 */
const A_OCCHIO = new Set(['grasso', 'latticino', 'frutta_secca', 'verdura', 'frutta', 'dolce'])

/** Sotto un quarto della sua porzione - e sotto questi grammi - non si pesa. */
const QUOTA_QB = 0.25
const GRAMMI_QB = 20

/** Lo scalino: i grammi si scrivono di cinque in cinque, come si pesano. */
const SCALINO = 5

type Riga = {
  componente: Componente
  alimento: Alimento | null
  quantita: number
  /** Oltre questo non si va, o null quando l'alimento non e' nel vocabolario. */
  tetto: number | null
  kcalPerGrammo: number
}

function kcalPerGrammo(alimento: Alimento | null): number {
  if (!alimento || alimento.kcal === null) return 0

  const kcal = Number(alimento.kcal)

  return Number.isFinite(kcal) && kcal > 0 ? kcal / 100 : 0
}

function tettoDi(alimento: Alimento | null): number | null {
  if (!alimento) return null

  const porzione = Number(alimento.quantita)

  if (!Number.isFinite(porzione) || porzione <= 0) return null

  return porzione * (TETTI[alimento.gruppo] ?? TETTO)
}

/**
 * Taglia le esagerazioni e rimette in tavola le calorie tolte.
 *
 * Due passaggi, e il secondo e' importante quanto il primo. Togliere 15 g di
 * olio vuol dire togliere 135 kcal, e un pranzo che doveva darti 650 kcal e
 * te ne da' 515 non e' un pranzo piu' sano: e' un pranzo che ti lascia con
 * fame, cioe' il modo piu' sicuro di far fallire una dieta. Quelle calorie
 * tornano, ma tornano **sul resto** - piu' pasta, piu' verdura, piu'
 * proteina - che e' esattamente quello che direbbe un nutrizionista davanti
 * a un piatto troppo condito: meno olio, non meno piatto.
 *
 * Sul condimento non tornano mai, altrimenti il primo passaggio si annullerebbe
 * da solo.
 */
export function dosiRagionevoli(
  componenti: Componente[],
  vocabolario: Map<number, Alimento>,
): Componente[] {
  const righe: Riga[] = componenti.map((componente) => {
    const alimento =
      componente.alimentoId === null ? null : (vocabolario.get(componente.alimentoId) ?? null)

    return {
      componente,
      alimento,
      quantita: componente.quantita,
      tetto: tettoDi(alimento),
      kcalPerGrammo: kcalPerGrammo(alimento),
    }
  })

  // Primo passaggio: nessun ingrediente pesa piu' di quanto una sua porzione
  // possa ragionevolmente pesare.
  let tolte = 0
  const ridotte = new Set<Riga>()

  for (const riga of righe) {
    if (riga.tetto === null || riga.quantita <= riga.tetto) continue

    tolte += (riga.quantita - riga.tetto) * riga.kcalPerGrammo
    riga.quantita = riga.tetto
    ridotte.add(riga)
  }

  // Secondo passaggio: quello che non vale la pena pesare diventa "q.b.".
  //
  // Va fatto **qui**, prima di ridistribuire, e non alla fine: tre formaggi
  // da cinque grammi sono cinquanta calorie, e se sparissero dopo il conto
  // il piatto arriverebbe in tavola piu' corto di quello che doveva essere.
  // Cosi' invece quelle calorie le raccoglie il piatto, dove si vedono.
  const aOcchio = new Set<Riga>()

  for (const riga of righe) {
    if (!daNonPesare(riga)) continue

    tolte += riga.quantita * riga.kcalPerGrammo
    riga.quantita = 0
    aOcchio.add(riga)
  }

  // Terzo passaggio: le calorie tolte tornano sul resto del piatto.
  //
  // A giri, perche' chi cresce ha anche lui un tetto: quando lo tocca, quello
  // che restava da ridistribuire passa agli altri. Quattro giri bastano - a
  // quel punto o il piatto ha ripreso quello che gli serviva, o e' un piatto
  // che non puo' reggere quelle calorie, e forzarlo sarebbe tornare al punto
  // di partenza da un'altra porta.
  let restano = tolte

  for (let giro = 0; giro < 4 && restano > 1; giro++) {
    const crescono = righe.filter(
      (r) =>
        r.alimento !== null &&
        !STRETTI.has(r.alimento.gruppo) &&
        r.tetto !== null &&
        r.quantita < r.tetto &&
        r.quantita > 0 &&
        r.kcalPerGrammo > 0 &&
        // Un "q.b." non torna a essere un peso: e' appena diventato una cosa
        // che si mette a occhio, e rimetterci dentro delle calorie vorrebbe
        // dire chiedere di pesare di nuovo quel cucchiaino.
        !aOcchio.has(r),
    )

    if (crescono.length === 0) break

    const adesso = crescono.reduce((somma, r) => somma + r.quantita * r.kcalPerGrammo, 0)

    if (adesso <= 0) break

    // Tutti per lo stesso fattore: dentro quello che resta del piatto le
    // proporzioni della ricetta continuano a valere.
    const fattore = 1 + restano / adesso
    let rimesse = 0

    for (const riga of crescono) {
      const cresciuta = Math.min(riga.quantita * fattore, riga.tetto as number)

      rimesse += (cresciuta - riga.quantita) * riga.kcalPerGrammo
      riga.quantita = cresciuta
    }

    if (rimesse <= 0) break

    restano -= rimesse
  }

  return righe.map((riga) => ({
    ...riga.componente,
    quantita: arrotonda(riga.quantita),
    ...(ridotte.has(riga) ? { ridotto: true } : {}),
  }))
}

/**
 * Se di questo ingrediente e' rimasto cosi' poco che scriverlo in grammi
 * peserebbe piu' dell'ingrediente stesso.
 *
 * Zero e' il modo in cui l'app scrive gia' "q.b.": non si inventa niente.
 */
function daNonPesare(riga: Riga): boolean {
  if (riga.alimento === null || riga.quantita <= 0) return false
  if (!A_OCCHIO.has(riga.alimento.gruppo)) return false

  const porzione = Number(riga.alimento.quantita)

  if (!Number.isFinite(porzione) || porzione <= 0) return false

  return riga.quantita < porzione * QUOTA_QB && riga.quantita < GRAMMI_QB
}

function arrotonda(grammi: number): number {
  if (grammi <= 0) return 0

  return Math.max(SCALINO, Math.round(grammi / SCALINO) * SCALINO)
}
