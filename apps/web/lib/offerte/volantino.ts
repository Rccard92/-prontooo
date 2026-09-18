/**
 * Il lettore dei volantini.
 *
 * Un volantino non e' un documento: e' un manifesto. Il testo che ne esce e'
 * a pezzi, senza ordine affidabile, con il prezzo che a volte precede il
 * prodotto e a volte lo segue. Quindi non si cerca una struttura - non c'e' -
 * si cerca **il prezzo**, e intorno al prezzo si guarda cosa c'e'.
 *
 * Le righe senza prezzo si buttano: sono slogan, orari, indirizzi.
 */

export type OffertaGrezza = {
  rigaGrezza: string
  nomeGrezzo: string
  marca: string | null
  formato: string | null
  prezzo: number
  prezzoUnitario: number | null
  unitaPrezzo: 'kg' | 'l' | null
}

/** 1,99 · € 2,49 · 2.99€ · 12,00 */
const PREZZO = /(?:€\s*)?(\d{1,3})[.,](\d{2})\s*(?:€|eur)?/i

/** "al kg 4,98" · "€/kg 4,98" · "prezzo al litro 1,20" */
const UNITARIO = /(?:al\s+|€\s*\/\s*|prezzo\s+al\s+)(kg|chilo|litro|l)\b[^\d]{0,12}(\d{1,3})[.,](\d{2})/i

/** "500 g" · "1,5 l" · "conf. 2 x 125 g" · "6 pz" */
const FORMATO = /\b(?:conf\.?\s*)?(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:x\s*(\d{1,4})\s*)?(g|gr|grammi|kg|ml|cl|l|lt|litri|pz|pezzi)\b/i

/** Righe che sul volantino non sono prodotti. */
const RUMORE =
  /^(?:offerta|offerte|sottocosto|super\s*prezzo|prezzo\s*shock|valid[oa]|dal|fino a|solo|scopri|risparmi|convenienza|tessera|carta fedelt|punti|orari|aperto|ingrosso|volantino|pag(?:ina)?\.?\s*\d+|www\.|seguici)/i

/** Percentuali di sconto e simili, che non sono un prezzo. */
const SCONTO = /-?\s*\d{1,2}\s*%/

function aNumero(intero: string, decimali: string): number {
  return Number(`${intero}.${decimali}`)
}

/** Toglie dal nome quello che nome non e': prezzi, sconti, formati, simboli. */
function ripulisci(testo: string): string {
  return testo
    .replace(new RegExp(PREZZO.source, 'gi'), ' ')
    .replace(/-?\s*\d{1,2}\s*%/g, ' ')
    .replace(/\b(?:al\s+(?:kg|chilo|litro|l)|€\s*\/\s*(?:kg|l))\b/gi, ' ')
    .replace(/[*•·|©®™]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g, '')
    .trim()
}

/**
 * La marca, se si riesce a dirlo: una parola tutta maiuscola dentro il nome.
 *
 * I volantini scrivono quasi sempre la marca in maiuscolo. Non e' una regola
 * sicura, per questo la marca resta un'informazione a parte e non entra mai
 * nell'aggancio all'alimento.
 */
function marcaDi(nome: string): string | null {
  const parole = nome.split(/\s+/).filter((p) => p.length >= 3)
  const maiuscole = parole.filter((p) => p === p.toUpperCase() && /^[A-ZÀ-Ü'&.]+$/.test(p))

  // Se e' maiuscolo tutto, non e' la marca: e' lo stile del volantino.
  if (maiuscole.length === 0 || maiuscole.length === parole.length) return null

  return maiuscole.join(' ')
}

function formatoDi(testo: string): string | null {
  const trovato = FORMATO.exec(testo)

  if (!trovato) return null

  const [intero, moltiplicatore, unita] = [trovato[1]!, trovato[2], trovato[3]!]

  return moltiplicatore ? `${intero} x ${moltiplicatore} ${unita}` : `${intero} ${unita}`
}

function unitarioDi(testo: string): { prezzo: number; unita: 'kg' | 'l' } | null {
  const trovato = UNITARIO.exec(testo)

  if (!trovato) return null

  const unita = trovato[1]!.toLowerCase().startsWith('l') ? 'l' : 'kg'

  return { prezzo: aNumero(trovato[2]!, trovato[3]!), unita }
}

/**
 * Da una riga di volantino, l'offerta - se la riga e' un'offerta.
 *
 * La riga deve avere un prezzo e, tolto il prezzo, deve restare abbastanza
 * testo da essere il nome di qualcosa. Tre lettere non bastano.
 */
export function leggiRiga(riga: string): OffertaGrezza | null {
  const pulita = riga.replace(/\s+/g, ' ').trim()

  if (pulita.length < 4) return null
  if (RUMORE.test(pulita)) return null

  const prezzi = [...pulita.matchAll(new RegExp(PREZZO.source, 'gi'))]

  if (prezzi.length === 0) return null

  const unitario = unitarioDi(pulita)

  // Il prezzo del prodotto e' il primo che non sia il prezzo al kg.
  const candidati = prezzi
    .map((p) => aNumero(p[1]!, p[2]!))
    .filter((valore) => !unitario || valore !== unitario.prezzo)

  const prezzo = candidati[0] ?? aNumero(prezzi[0]![1]!, prezzi[0]![2]!)

  // Sopra i cento euro non e' la spesa: e' un elettrodomestico o un errore.
  if (prezzo <= 0 || prezzo > 100) return null

  const nome = ripulisci(pulita)

  if (nome.length < 4) return null
  // Un nome fatto solo di cifre e' un residuo, non un prodotto.
  if (!/[a-zà-ü]{3}/i.test(nome)) return null
  if (SCONTO.test(nome)) return null

  return {
    rigaGrezza: pulita,
    nomeGrezzo: nome,
    marca: marcaDi(nome),
    formato: formatoDi(pulita),
    prezzo,
    prezzoUnitario: unitario?.prezzo ?? null,
    unitaPrezzo: unitario?.unita ?? null,
  }
}

/**
 * Tutte le offerte di un volantino.
 *
 * Il prezzo sta spesso su una riga sua, staccato dal prodotto: si prova
 * allora ad accorpare la riga del prezzo con quella prima, che e' come sono
 * impaginati quasi tutti i volantini.
 */
export function leggiVolantino(testo: string): OffertaGrezza[] {
  const righe = testo
    .split(/\r?\n/)
    .map((r) => r.replace(/\s+/g, ' ').trim())
    .filter((r) => r.length > 0)

  const offerte: OffertaGrezza[] = []
  const viste = new Set<string>()

  for (let i = 0; i < righe.length; i += 1) {
    const riga = righe[i]!
    let letta = leggiRiga(riga)

    // Riga di solo prezzo: il prodotto e' quella sopra.
    if (!letta && i > 0 && /^[€\s]*\d{1,3}[.,]\d{2}\s*(?:€|eur)?$/i.test(riga)) {
      letta = leggiRiga(`${righe[i - 1]} ${riga}`)
    }

    if (!letta) continue

    const chiave = `${letta.nomeGrezzo.toLowerCase()}|${letta.prezzo}`

    if (viste.has(chiave)) continue

    viste.add(chiave)
    offerte.push(letta)
  }

  return offerte
}
