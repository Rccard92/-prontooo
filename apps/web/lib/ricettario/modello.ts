import type { Fascia } from '../ricette/fasce'
import { capo } from '../ricette/posti'

/**
 * Il ricettario scritto per componenti.
 *
 * Una ricetta del catalogo e' un blocco chiuso: ha i suoi ingredienti, i suoi
 * grammi, e per usarla dovresti piegare la tua lista alla sua. Qui e'
 * l'opposto. Una ricetta componibile non porta ingredienti: porta **posti**,
 * e i posti li riempiono i componenti del tuo pasto, coi grammi che sono gia'
 * stati calcolati per te.
 *
 * Cosi' la stessa ricetta vale per chiunque e per ogni giorno: "pasta saltata
 * con la verdura" diventa 80 g di farro con 200 g di zucchine oggi e 100 g di
 * pasta integrale con 250 g di broccoli domani, senza scrivere due ricette.
 *
 * E funziona **senza chiave API**: e' un elenco scritto a mano, non un modello.
 */

/** Un posto dentro la ricetta, che un componente del pasto viene a riempire. */
export type Posto = {
  /** Come lo richiama il testo dei passi: `{pasta}`. */
  chiave: string
  /** Il ruolo del pasto che questo posto si aspetta. */
  ruolo: string
  /** I gruppi di alimenti che ci stanno davvero bene. */
  gruppi: string[]
  /** Etichette che qui non ci stanno: il posto le rifiuta. */
  escludi?: string[]
  /** Se manca, la ricetta si fa lo stesso. */
  facoltativo?: boolean
  /**
   * L'alimento con cui il posto e' nato, e se il titolo lo nomina.
   *
   * Li mettono solo le ricette del catalogo, che nascono da alimenti precisi.
   * Quelle scritte a mano non li hanno e non devono averli: "Pasta e legumi"
   * accetta qualunque pasta ed e' quello il suo mestiere.
   */
  alimentoId?: number
  nome?: string
  nelTitolo?: boolean
}

export type RicettaComponibile = {
  id: string
  titolo: string
  fasce: Fascia[]
  /** Minuti dall'inizio al piatto in tavola. */
  minuti: number
  posti: Posto[]
  /** Quello che non si pesa: aglio, sale, erbe. Sta scritto, non conta. */
  liberi?: string[]
  /**
   * I passi.
   *
   * Nelle ricette scritte a mano portano `{chiave}` dove va nominato il
   * componente assegnato. In quelle che arrivano dal catalogo no: li' il testo
   * e' quello della fonte, parola per parola. "Cuocete la pasta" va bene per
   * 80 g come per 120, e riscrivere il procedimento di qualcun altro per far
   * tornare un numero vorrebbe dire rompere una ricetta che funziona.
   */
  passi: string[]
  nota?: string
  /** La foto, quando la ricetta arriva dal catalogo. */
  immagineUrl?: string | null
  /** Chi l'ha scritta, e dove sta. Una ricetta di altri si cita. */
  fonte?: { nome: string; url: string } | null
}

/** Un componente del pasto, con quel tanto di alimento che serve per abbinarlo. */
export type ComponenteAbbinabile = {
  ruolo: string
  alimentoId: number | null
  nome: string
  quantita: number
  unita: string
  gruppo: string | null
  etichette: string[]
}

/**
 * Quanto bene una ricetta calza il pasto.
 *
 * Tre livelli e non si'/no, perche' il si'/no butterebbe via quasi tutto:
 * quasi nessuna ricetta vera combacia esattamente con un pasto composto da
 * una lista di ingredienti.
 */
export const LIVELLI = ['calza', 'vicina', 'adattabile'] as const
export type Livello = (typeof LIVELLI)[number]

export const NOME_LIVELLO: Record<Livello, string> = {
  calza: 'Con quello che hai',
  vicina: 'Ci siamo quasi',
  adattabile: 'Ti manca poco',
}

export const SPIEGA_LIVELLO: Record<Livello, string> = {
  calza: 'Usa esattamente i componenti di questo pasto.',
  vicina: 'Usa i componenti di questo pasto, qualcuno fuori dal solito.',
  adattabile: 'Ci arrivi aggiungendo quello che manca.',
}

export type Abbinamento = {
  ricetta: RicettaComponibile
  livello: Livello
  /** Chiave del posto -> componente che lo riempie. */
  assegnati: Map<string, ComponenteAbbinabile>
  /** I posti rimasti vuoti, solo per il livello *adattabile*. */
  mancanti: Posto[]
  /** I componenti del pasto che la ricetta non usa: vanno mangiati a parte. */
  avanzati: ComponenteAbbinabile[]
  /** Quanto e' stato un abbinamento pulito: serve solo a ordinare. */
  punteggio: number
}

/** Il posto accetta questo componente? Due gradi: pieno e di ripiego. */
function accetta(posto: Posto, componente: ComponenteAbbinabile): 'pieno' | 'ripiego' | null {
  if (componente.quantita === 0) return null
  if (posto.escludi?.some((e) => componente.etichette.includes(e))) return null

  // Il titolo nomina questo alimento: allora e' quello, o almeno lo stesso.
  //
  // Senza questa riga il gruppo bastava, e il gruppo `pesce` lo riempiono il
  // baccala', i calamari e i gamberi allo stesso modo: "Baccala' alle
  // verdure" e' arrivato in tavola coi calamari a pranzo e coi gamberi a
  // cena, lo stesso giorno. Un titolo che nomina un alimento promette
  // quell'alimento, e una promessa rotta e' peggio di una proposta in meno.
  //
  // "Lo stesso" e non "lo stessissimo": il Carnaroli e il basmati sono tutti
  // e due riso, e "Risotto alla monzese" non promette la varieta'. Pretendere
  // l'alimento identico vorrebbe dire non proporre mai quella ricetta.
  if (posto.nelTitolo) {
    if (posto.alimentoId !== undefined && componente.alimentoId === posto.alimentoId) {
      return 'pieno'
    }

    return posto.nome !== undefined && capo(posto.nome) === capo(componente.nome) ? 'pieno' : null
  }

  const gruppoGiusto = componente.gruppo !== null && posto.gruppi.includes(componente.gruppo)
  const ruoloGiusto = componente.ruolo === posto.ruolo

  if (gruppoGiusto && ruoloGiusto) return 'pieno'
  // Il gruppo conta piu' del ruolo: il ruolo lo abbiamo dedotto noi
  // dall'alimento, il gruppo sta scritto nel vocabolario.
  if (gruppoGiusto) return 'pieno'

  // Il ripiego vale solo nei posti larghi. Un posto che nomina un gruppo solo
  // - `gruppi: ['pesce']` - lo nomina apposta: accettarci il manzo perche'
  // copre lo stesso ruolo darebbe "pesce al forno" fatto con la bistecca.
  if (ruoloGiusto && posto.gruppi.length > 1) return 'ripiego'

  return null
}

/**
 * Prova a riempire i posti di una ricetta coi componenti del pasto.
 *
 * Si assegna un componente a un posto solo, e prima si sistemano i posti
 * difficili - quelli che accettano pochi gruppi - altrimenti un posto largo
 * si prende il componente che serviva a un posto stretto.
 */
export function abbina(
  ricetta: RicettaComponibile,
  componenti: ComponenteAbbinabile[],
): Abbinamento | null {
  const assegnati = new Map<string, ComponenteAbbinabile>()
  const liberi = [...componenti]
  const mancanti: Posto[] = []
  let ripieghi = 0

  const ordinati = [...ricetta.posti].sort((a, b) => a.gruppi.length - b.gruppi.length)

  for (const posto of ordinati) {
    let scelto: { componente: ComponenteAbbinabile; grado: 'pieno' | 'ripiego' } | null = null

    for (const componente of liberi) {
      const grado = accetta(posto, componente)

      if (grado === null) continue
      if (grado === 'pieno') {
        scelto = { componente, grado }
        break
      }
      scelto ??= { componente, grado }
    }

    if (!scelto) {
      if (!posto.facoltativo) mancanti.push(posto)
      continue
    }

    if (scelto.grado === 'ripiego') ripieghi += 1

    assegnati.set(posto.chiave, scelto.componente)
    liberi.splice(liberi.indexOf(scelto.componente), 1)
  }

  // Due posti vuoti non sono piu' un adattamento: e' un'altra ricetta.
  if (mancanti.length > 1) return null

  // Quello che la ricetta non usa e si mangia comunque, accanto al piatto.
  // Le voci "a piacere" hanno quantita' zero e non sono avanzi di niente.
  const avanzati = liberi.filter((c) => c.quantita > 0)

  // Manca un pezzo **e** intanto ti avanza roba in mano: non e' una ricetta a
  // cui manca poco, e' la ricetta sbagliata per questo pasto. Senza questa
  // riga "pane e spalmabile" si proponeva a colazione usando l'olio come
  // spalmabile, col pane da comprare e la fettina lasciata sul tavolo.
  if (mancanti.length > 0 && avanzati.length > 0) return null

  // Se la ricetta lascia fuori **piu'** di quello che usa, il titolo non e' di
  // questo pasto: e' il nome di un'altra cosa messo sopra il tuo piatto. E'
  // cosi' che "Ricotta e miele" si e' ritrovata a intitolare una colazione con
  // dentro salmone affumicato e granita siciliana.
  //
  // Pari non basta per scartarla: pasta al pomodoro con la fettina e la frutta
  // accanto usa due componenti e ne lascia due, ed e' un pranzo normale.
  if (avanzati.length > assegnati.size) return null

  // Un solo avanzo non declassa la ricetta: la frutta o il pane stanno
  // accanto al piatto senza entrarci, ed e' normale. Due sono un pasto che
  // la ricetta copre solo a meta'.
  const livello: Livello =
    mancanti.length > 0 ? 'adattabile' : ripieghi > 0 || avanzati.length > 1 ? 'vicina' : 'calza'

  const punteggio =
    assegnati.size * 10 - ripieghi * 4 - avanzati.length * 2 - mancanti.length * 20

  return { ricetta, livello, assegnati, mancanti, avanzati, punteggio }
}

/** "200 g di zucchine", con la quantita' che e' gia' quella del tuo pasto. */
export function scrivi(componente: ComponenteAbbinabile): string {
  if (componente.quantita === 0) return componente.nome.toLowerCase()

  return `${componente.quantita} ${componente.unita} di ${componente.nome.toLowerCase()}`
}

/** I passi con dentro i componenti veri al posto dei segnaposto. */
export function passiDi(abbinamento: Abbinamento): string[] {
  return abbinamento.ricetta.passi.map((passo) =>
    passo.replace(/\{(\w+)\}/g, (intero, chiave: string) => {
      const componente = abbinamento.assegnati.get(chiave)

      if (componente) return scrivi(componente)

      const posto = abbinamento.ricetta.posti.find((p) => p.chiave === chiave)

      return posto ? `${chiave} (da aggiungere)` : intero
    }),
  )
}

/** La lista di quello che serve, coi grammi del pasto. */
export function occorrente(abbinamento: Abbinamento): string[] {
  const daiPosti = abbinamento.ricetta.posti
    .map((posto) => abbinamento.assegnati.get(posto.chiave))
    .filter((c): c is ComponenteAbbinabile => c !== undefined)
    .map(scrivi)

  return [...daiPosti, ...(abbinamento.ricetta.liberi ?? []).map((l) => `${l} q.b.`)]
}
