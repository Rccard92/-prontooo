/**
 * Da quanto pesi a quanti grammi di pasta.
 *
 * Fino a qui le porzioni erano numeri scritti a mano nel vocabolario: 80 g di
 * pasta, 150 g di pollo, 200 g di verdura. Sono porzioni di riferimento
 * ragionevoli per un adulto medio, ma **non sono le tue**: non sanno quanto
 * pesi, quanti anni hai, quanto ti muovi.
 *
 * Qui si calcola il fabbisogno vero e da quello si arriva ai grammi. Il metodo
 * e' quello standard e non serve nessun modello:
 *
 * 1. **Mifflin-St Jeor** da' il metabolismo basale - quanto consumi da fermo
 * 2. per il **fattore di attivita'** si arriva al fabbisogno giornaliero
 * 3. l'**obiettivo** lo sposta: mantenere, dimagrire, mettere massa
 * 4. il totale si divide fra i pasti e dentro il pasto si scala quello che c'e'
 *
 * Resta una **stima**, e l'app lo dice dove serve. Un nutrizionista guarda
 * cose che una formula non vede.
 */

export const SESSI = ['uomo', 'donna'] as const
export type Sesso = (typeof SESSI)[number]

export const ATTIVITA = ['sedentario', 'leggero', 'moderato', 'attivo', 'molto_attivo'] as const
export type Attivita = (typeof ATTIVITA)[number]

export const OBIETTIVI = ['mantenere', 'dimagrire', 'massa'] as const
export type Obiettivo = (typeof OBIETTIVI)[number]

export const NOME_ATTIVITA: Record<Attivita, string> = {
  sedentario: 'Fermo quasi sempre',
  leggero: 'Cammino, un po’ di sport',
  moderato: 'Allenamento 3-4 volte',
  attivo: 'Allenamento 5-6 volte',
  molto_attivo: 'Lavoro fisico o due allenamenti',
}

export const NOME_OBIETTIVO: Record<Obiettivo, string> = {
  mantenere: 'Restare come sto',
  dimagrire: 'Perdere peso',
  massa: 'Mettere massa',
}

/** Quanto moltiplica il basale ogni livello di attivita'. Valori standard. */
const FATTORE_ATTIVITA: Record<Attivita, number> = {
  sedentario: 1.2,
  leggero: 1.375,
  moderato: 1.55,
  attivo: 1.725,
  molto_attivo: 1.9,
}

/** Quanto sposta l'obiettivo. Il deficit e' moderato apposta. */
const FATTORE_OBIETTIVO: Record<Obiettivo, number> = {
  mantenere: 1,
  dimagrire: 0.85,
  massa: 1.1,
}

/**
 * Proteine per chilo di peso.
 *
 * Chi dimagrisce ne vuole di piu', non di meno: in deficit la proteina e'
 * quello che tiene il muscolo mentre il resto cala.
 */
const PROTEINE_PER_KG: Record<Obiettivo, number> = {
  mantenere: 1.4,
  dimagrire: 1.8,
  massa: 1.7,
}

export type DatiCorpo = {
  sesso: Sesso
  eta: number
  altezza: number
  pesoKg: number
  attivita: Attivita
  obiettivo: Obiettivo
}

/** Ci sono tutti i dati per fare il conto? */
export function datiCompleti(dati: Partial<DatiCorpo> | null): dati is DatiCorpo {
  if (!dati) return false

  return (
    typeof dati.eta === 'number' &&
    dati.eta >= 14 &&
    dati.eta <= 100 &&
    typeof dati.altezza === 'number' &&
    dati.altezza >= 120 &&
    dati.altezza <= 230 &&
    typeof dati.pesoKg === 'number' &&
    dati.pesoKg >= 30 &&
    dati.pesoKg <= 300 &&
    dati.sesso !== undefined &&
    dati.attivita !== undefined &&
    dati.obiettivo !== undefined
  )
}

/** Mifflin-St Jeor: quanto consumi stando fermo, in kcal al giorno. */
export function metabolismoBasale(dati: DatiCorpo): number {
  const comune = 10 * dati.pesoKg + 6.25 * dati.altezza - 5 * dati.eta

  return Math.round(dati.sesso === 'uomo' ? comune + 5 : comune - 161)
}

export type Fabbisogno = {
  basale: number
  giornaliero: number
  proteine: number
  grassi: number
  carboidrati: number
}

/**
 * Il fabbisogno di una giornata, coi macro gia' divisi.
 *
 * I grassi stanno al 27% delle calorie - dentro la forchetta che si considera
 * sana - le proteine vengono dal peso, e i carboidrati prendono quello che
 * resta. Si parte dai due vincoli veri e si lascia libero il terzo, invece di
 * fissare tre percentuali che poi non tornano.
 */
export function fabbisognoDi(dati: DatiCorpo, fattoreGiorno = 1): Fabbisogno {
  const basale = metabolismoBasale(dati)

  const grezzo =
    basale * FATTORE_ATTIVITA[dati.attivita] * FATTORE_OBIETTIVO[dati.obiettivo] * fattoreGiorno

  // Mai sotto il metabolismo basale: sotto quella riga non si dimagrisce
  // meglio, si sta solo peggio.
  const giornaliero = Math.round(Math.max(grezzo, basale))

  const proteine = Math.round(dati.pesoKg * PROTEINE_PER_KG[dati.obiettivo])
  const grassi = Math.round((giornaliero * 0.27) / 9)
  const restanti = giornaliero - proteine * 4 - grassi * 9

  return {
    basale,
    giornaliero,
    proteine,
    grassi,
    // Se proteine e grassi da soli sforano - succede solo a deficit molto
    // stretti - i carboidrati non vanno sotto zero.
    carboidrati: Math.max(0, Math.round(restanti / 4)),
  }
}

/**
 * Come si divide la giornata fra i pasti.
 *
 * Sono le proporzioni classiche di una giornata italiana. Si normalizzano
 * sulle fasce che hai davvero: chi non fa merenda non deve perdere quel 10%,
 * deve vederlo ridistribuito sugli altri pasti.
 */
const QUOTA_FASCIA: Record<string, number> = {
  colazione: 0.2,
  spuntino: 0.05,
  pranzo: 0.35,
  merenda: 0.1,
  cena: 0.3,
}

export function quotePerFasce(fasce: string[]): Map<string, number> {
  const presenti = fasce.filter((f) => QUOTA_FASCIA[f] !== undefined)
  const totale = presenti.reduce((t, f) => t + (QUOTA_FASCIA[f] ?? 0), 0)
  const quote = new Map<string, number>()

  if (totale <= 0) return quote

  for (const fascia of presenti) quote.set(fascia, (QUOTA_FASCIA[fascia] ?? 0) / totale)

  return quote
}

/** Le kcal che spettano a ogni pasto, dato il fabbisogno del giorno. */
export function kcalPerFascia(giornaliero: number, fasce: string[]): Map<string, number> {
  const per = new Map<string, number>()

  for (const [fascia, quota] of quotePerFasce(fasce)) {
    per.set(fascia, Math.round(giornaliero * quota))
  }

  return per
}
