/**
 * Lettura di una dieta dal PDF del nutrizionista.
 *
 * La struttura che scrivono e' regolare e si ripete:
 *
 *   LUNEDI
 *   COLAZIONE
 *   - Yogurt greco 5% 150g o Yogurt greco 0% 150g
 *   - Corn flakes 20g o Fiocchi di avena 20g
 *
 * Ogni riga che inizia con un trattino e' un posto del pasto, e le alternative
 * sono separate da " o ". Il parser e' deterministico e non fa richieste di
 * rete: entra testo, escono voci. Cosi' e' testabile senza un PDF vero.
 */

export const FASCE_PDF = ['COLAZIONE', 'SPUNTINO', 'PRANZO', 'MERENDA', 'CENA'] as const

const GIORNI_PDF = [
  'LUNEDÌ',
  'LUNEDI',
  'MARTEDÌ',
  'MARTEDI',
  'MERCOLEDÌ',
  'MERCOLEDI',
  'GIOVEDÌ',
  'GIOVEDI',
  'VENERDÌ',
  'VENERDI',
  'SABATO',
  'DOMENICA',
]

/** Titoli che compaiono dentro un pasto e non sono alimenti. */
const SOTTOTITOLI = /^(PIATTO UNICO|SPUNTINO DEL MATTINO|SPUNTINO POMERIDIANO|OPPURE)$/i

export type VocePdf = {
  fascia: string
  riga: number
  ordine: number
  testo: string
  /** Zero vuol dire "quanto basta": il nutrizionista non l'ha pesato. */
  quantita: number
  unita: 'g' | 'ml'
  aPiacere?: boolean
}

export type EsitoLettura = {
  voci: VocePdf[]
  /** Righe che sembravano alimenti ma senza quantita' leggibile. */
  scartate: string[]
  giorniTrovati: number
}

const FASCIA_NORMALE: Record<string, string> = {
  COLAZIONE: 'colazione',
  SPUNTINO: 'spuntino',
  PRANZO: 'pranzo',
  MERENDA: 'merenda',
  CENA: 'cena',
}

/** "Yogurt greco 5% 150g" -> nome e quantita'. */
export function spezzaAlternativa(testo: string): { nome: string; quantita: number; unita: 'g' | 'ml' } | null {
  const pulito = testo.trim().replace(/\s+/g, ' ')
  const trovato = /^(.*?)[\s(]*(\d+(?:[.,]\d+)?)\s*(g|gr|ml|grammi)\b\.?\)?$/i.exec(pulito)

  if (!trovato || !trovato[1] || !trovato[2]) return null

  const nome = trovato[1].replace(/[\s,;:.-]+$/, '').trim()
  const quantita = Number(trovato[2].replace(',', '.'))

  if (!nome || !Number.isFinite(quantita) || quantita <= 0) return null

  return {
    nome,
    quantita,
    unita: /ml/i.test(trovato[3] ?? '') ? 'ml' : 'g',
  }
}

/**
 * Legge il testo di un PDF e ne estrae le voci.
 *
 * I giorni vengono fusi: di una dieta settimanale teniamo l'unione delle
 * alternative per fascia, non il calendario. E' quello che serve - la lista di
 * cosa puoi mangiare - e ti lascia libero di decidere il giorno per giorno.
 */
export function leggiDieta(testo: string): EsitoLettura {
  const voci: VocePdf[] = []
  const scartate: string[] = []
  const giorni = new Set<string>()

  // Chiave "fascia|nome normalizzato" per non ripetere la stessa alternativa
  // che compare in giorni diversi.
  const visti = new Set<string>()
  const righePerFascia = new Map<string, number>()
  // Le righe uguali (stesso insieme di alternative) si fondono in una sola.
  const rigaDiFirma = new Map<string, number>()

  let fascia: string | null = null

  const prossimaRiga = (f: string): number => {
    const n = righePerFascia.get(f) ?? 0
    righePerFascia.set(f, n + 1)
    return n
  }

  for (const grezza of testo.split('\n')) {
    const riga = grezza.trim().replace(/\s+/g, ' ')

    if (!riga) continue

    const maiuscola = riga.toUpperCase().replace(/[^A-ZÀÈÉÌÒÙ ]/g, '').trim()

    if (GIORNI_PDF.includes(maiuscola)) {
      giorni.add(maiuscola)
      continue
    }

    const fasciaTrovata = FASCE_PDF.find((f) => maiuscola === f || maiuscola.startsWith(f + ' '))

    if (fasciaTrovata && riga.length < 30) {
      fascia = FASCIA_NORMALE[fasciaTrovata] ?? null
      continue
    }

    if (!fascia) continue
    if (!riga.startsWith('-') && !riga.startsWith('•')) continue

    const contenuto = riga.replace(/^[-•]\s*/, '')

    if (SOTTOTITOLI.test(contenuto)) continue

    const alternative = contenuto
      .split(/\s+o\s+/i)
      .map((a) => a.trim())
      .filter(Boolean)

    const lette = alternative.map(spezzaAlternativa)

    // Una riga senza numeri e' un "a piacere": limone, rucola, aceto. Buttarla
    // vorrebbe dire perdere meta' del contorno di una dieta vera.
    if (lette.every((l) => l === null)) {
      if (sembraAlimento(contenuto)) {
        const numeroRigaLibera = prossimaRiga(fascia)

        alternative.forEach((nome, i) => {
          const chiave = `${fascia}|${nome.toLowerCase()}`

          if (visti.has(chiave)) return

          visti.add(chiave)
          voci.push({
            fascia,
            riga: numeroRigaLibera,
            ordine: i,
            testo: ripulisciAPiacere(nome),
            quantita: 0,
            unita: 'g',
            aPiacere: true,
          })
        })
      } else {
        scartate.push(contenuto)
      }

      continue
    }

    const firma = lette
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .map((l) => l.nome.toLowerCase())
      .sort()
      .join('|')

    const chiaveRiga = `${fascia}#${firma}`
    let numeroRiga = rigaDiFirma.get(chiaveRiga)

    if (numeroRiga === undefined) {
      numeroRiga = prossimaRiga(fascia)
      rigaDiFirma.set(chiaveRiga, numeroRiga)
    }

    let ordine = 0

    for (const letta of lette) {
      if (!letta) continue

      const chiave = `${fascia}|${letta.nome.toLowerCase()}`

      if (visti.has(chiave)) continue

      visti.add(chiave)
      voci.push({
        fascia,
        riga: numeroRiga,
        ordine: ordine++,
        testo: letta.nome,
        quantita: letta.quantita,
        unita: letta.unita,
      })
    }
  }

  return { voci, scartate, giorniTrovati: giorni.size }
}

/**
 * Collega il nome letto dal PDF a un alimento del vocabolario.
 *
 * Tre passaggi, dal piu' sicuro al piu' generoso. Quello che non si aggancia
 * non si butta: resta come testo grezzo e lo colleghi tu dalla schermata di
 * conferma, una volta sola.
 */
export function agganciaAlimento(
  nome: string,
  alimenti: { id: number; nome: string }[],
): number | null {
  const cercato = normalizza(nome)

  const esatto = alimenti.find((a) => normalizza(a.nome) === cercato)

  if (esatto) return esatto.id

  // Contenimento: "Yogurt greco 5% alla frutta" trova "Yogurt greco 5%".
  const contenuto = alimenti
    .filter((a) => cercato.includes(normalizza(a.nome)) || normalizza(a.nome).includes(cercato))
    .sort((a, b) => b.nome.length - a.nome.length)[0]

  if (contenuto) return contenuto.id

  // Parole in comune: almeno due, e la prima deve combaciare.
  const parole = cercato.split(' ').filter((p) => p.length > 3)

  if (parole.length === 0) return null

  const perPunteggio = alimenti
    .map((a) => {
      const sue = normalizza(a.nome).split(' ')
      const comuni = parole.filter((p) => sue.includes(p))

      return { id: a.id, punti: comuni.length, primaUguale: sue[0] === parole[0] }
    })
    .filter((x) => x.punti >= 2 || (x.punti === 1 && x.primaUguale))
    .sort((a, b) => b.punti - a.punti)

  return perPunteggio[0]?.id ?? null
}

/** "Aceto balsamico q.t." -> "Aceto balsamico". */
function ripulisciAPiacere(testo: string): string {
  return testo
    .replace(/\b(q\.?\s?[bt]\.?|a piacere|a volonta'?|quanto basta)\b/gi, '')
    .replace(/[\s,;:.-]+$/, '')
    .trim()
}

/** Distingue "Rucola" da "Condire con cura" o da una nota del nutrizionista. */
function sembraAlimento(testo: string): boolean {
  const pulito = ripulisciAPiacere(testo)

  if (pulito.length < 3 || pulito.length > 60) return false
  // Una frase con un verbo coniugato e' una nota, non un alimento.
  if (/\b(bere|cuocere|condire|evitare|preferire|alternare|ricorda|usare|assumere)\b/i.test(pulito)) {
    return false
  }

  return /^[A-ZÀ-Üa-zà-ü]/.test(pulito) && pulito.split(' ').length <= 5
}

/**
 * Sinonimi e forme che i nutrizionisti usano e il vocabolario no.
 * Il singolare e il plurale li risolve `normalizza`; qui stanno i casi veri.
 */
const SINONIMI: Record<string, string> = {
  grana: 'parmigiano reggiano',
  'grana padano': 'parmigiano reggiano',
  'scaglie grana': 'scaglie parmigiano',
  cocomero: 'anguria',
  couscous: 'cous cous',
  'pan carre': 'pancarre integrale',
  pancarre: 'pancarre integrale',
  'te verde': 'te verde',
  'latte mucca intero': 'latte intero',
  'latte mucca intero senza lattosio': 'latte senza lattosio',
  'latte mucca p scr': 'latte intero',
  'gelato generico': 'gelato',
  'cornetto generico': 'cornetto',
  'brioche generica': 'brioche col tuppo',
  'granita generica': 'granita siciliana',
  'cereali generici colazione': 'cereali colazione',
  'biscotti generici colazione': 'biscotti secchi',
  'biscotti prima colazione': 'biscotti secchi',
  'uova gallina intero': 'uova',
  'uova gallina albume': 'albume',
  'olio oliva extra vergine': 'olio extravergine oliva',
  'verdure crude miste': 'insalata mista',
  'verdure cotte miste': 'verdure grigliate miste',
  'frutta fresca stagione': 'mela',
  'frutta secca oleosa mista': 'frutta secca mista',
  'burro mandorle': 'crema nocciole 100%',
  "burro d arachidi 100% naturale": 'burro arachidi',
  'crema spalmabile nocciole cacao': 'crema nocciole 100%',
  'crema nocciola cacao': 'crema nocciole 100%',
  'marmellata low sugar': 'marmellata senza zuccheri aggiunti',
  'marmellata classica': 'marmellata senza zuccheri aggiunti',
  'fette wasa segale': 'fette biscottate integrali',
  'yogurt scr frutta': 'yogurt bianco senza lattosio',
  'yogurt bianco scremato': 'yogurt bianco senza lattosio',
  actimel: 'yogurt bere probiotico',
  yakult: 'yogurt bere probiotico',
  'lc1 multifruit': 'yogurt bere probiotico',
  'budino proteico cioccolato': 'budino proteico',
  'budino proteico vaniglia': 'budino proteico',
  'mousse proteica cioccolato': 'mousse proteica',
  'barretta proteica 50%': 'barretta proteica',
  'barretta generica cereali': 'barretta proteica',
  'pesce azzurro': 'pesce azzurro',
  'condiriso': 'mais scatola',
}

function normalizza(testo: string): string {
  const base = testo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\b(di|del|della|dei|delle|al|alla|con|e|in|il|la|lo|i|gli|le|un|una)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const conSinonimo = SINONIMI[base] ?? base

  // Singolare e plurale italiani: si toglie la vocale finale e basta.
  // peperone/peperoni -> peperon, broccolo/broccoli -> broccol. Togliere di
  // piu' - i suffissi -etto, -ino - distrugge le parole: "petto" diventa "p".
  return conSinonimo
    .split(' ')
    .map((parola) => (parola.length > 4 ? parola.replace(/[aeiou]$/, '') : parola))
    .join(' ')
}
