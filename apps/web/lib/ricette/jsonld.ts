/**
 * Lettura di una ricetta da una pagina web, via schema.org/Recipe in JSON-LD.
 *
 * Quasi tutti i siti di cucina italiani pubblicano il blocco JSON-LD perche'
 * serve a loro per i risultati arricchiti di Google. Noi leggiamo quello: e'
 * dato strutturato e dichiarato dal sito, non HTML da indovinare.
 *
 * Qui dentro non si fanno richieste di rete: entra HTML, esce una ricetta.
 * Cosi' e' testabile senza dipendere da un sito vivo.
 */

export type RicettaEstratta = {
  titolo: string
  fonteUrl: string
  fonteNome: string
  immagineUrl: string | null
  descrizione: string | null
  minutiPreparazione: number | null
  minutiCottura: number | null
  minutiTotali: number | null
  porzioni: number | null
  categoriaFonte: string | null
  ingredienti: string[]
  passaggi: string[]
}

type Nodo = Record<string, unknown>

const ENTITA: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  igrave: 'ì',
  ograve: 'ò',
  ugrave: 'ù',
  deg: '°',
}

/** Toglie i tag, scioglie le entita', normalizza gli spazi. */
export function ripulisci(testo: string): string {
  return testo
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, codice: string) => String.fromCodePoint(Number(codice)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codice: string) => String.fromCodePoint(parseInt(codice, 16)))
    .replace(/&([a-z]+);/gi, (intero, nome: string) => ENTITA[nome.toLowerCase()] ?? intero)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Durate ISO 8601 come le scrive schema.org: PT1H30M, PT45M, P0DT1H0M.
 * Restituisce minuti, o null se non e' una durata leggibile o vale zero.
 */
export function minutiDaDurata(valore: unknown): number | null {
  if (typeof valore === 'number' && Number.isFinite(valore)) {
    return valore > 0 ? Math.round(valore) : null
  }

  if (typeof valore !== 'string') return null

  const trovato = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:[\d.]+S)?)?$/i.exec(valore.trim())

  if (!trovato) return null

  const giorni = Number(trovato[1] ?? 0)
  const ore = Number(trovato[2] ?? 0)
  const minuti = Number(trovato[3] ?? 0)
  const totale = giorni * 1440 + ore * 60 + minuti

  return totale > 0 ? totale : null
}

/** `4`, `"4 persone"`, `["4"]`, `"per 4-6 persone"` diventano tutti 4. */
export function porzioniDaValore(valore: unknown): number | null {
  const grezzo = Array.isArray(valore) ? valore[0] : valore

  if (typeof grezzo === 'number' && Number.isFinite(grezzo)) {
    return grezzo > 0 ? Math.round(grezzo) : null
  }

  if (typeof grezzo !== 'string') return null

  const trovato = /\d+/.exec(grezzo)

  if (!trovato) return null

  const numero = Number(trovato[0])

  return numero > 0 && numero <= 100 ? numero : null
}

function primaStringa(valore: unknown): string | null {
  if (typeof valore === 'string') return ripulisci(valore) || null

  if (Array.isArray(valore)) {
    for (const voce of valore) {
      const trovata = primaStringa(voce)
      if (trovata) return trovata
    }
    return null
  }

  if (valore && typeof valore === 'object') {
    const nodo = valore as Nodo
    // Gli ImageObject e i Person hanno il valore sotto `url` o `name`.
    return primaStringa(nodo.url) ?? primaStringa(nodo.name)
  }

  return null
}

function elencoDiStringhe(valore: unknown): string[] {
  if (typeof valore === 'string') {
    const pulita = ripulisci(valore)
    return pulita ? [pulita] : []
  }

  if (Array.isArray(valore)) return valore.flatMap(elencoDiStringhe)

  return []
}

/**
 * Le istruzioni arrivano in quattro forme diverse: stringa unica, elenco di
 * stringhe, elenco di HowToStep, elenco di HowToSection che contengono passi.
 */
function passaggiDaIstruzioni(valore: unknown): string[] {
  if (typeof valore === 'string') {
    return ripulisci(valore)
      .split(/(?<=[.!?])\s+(?=[A-ZÀÈÉÌÒÙ])/)
      .map((passo) => passo.trim())
      .filter(Boolean)
  }

  if (Array.isArray(valore)) return valore.flatMap(passaggiDaIstruzioni)

  if (valore && typeof valore === 'object') {
    const nodo = valore as Nodo
    const tipo = String(nodo['@type'] ?? '')

    if (tipo === 'HowToSection' && nodo.itemListElement) {
      return passaggiDaIstruzioni(nodo.itemListElement)
    }

    const testo = primaStringa(nodo.text) ?? primaStringa(nodo.name)

    return testo ? [testo] : []
  }

  return []
}

function haTipoRicetta(nodo: Nodo): boolean {
  const tipo = nodo['@type']

  if (typeof tipo === 'string') return tipo === 'Recipe'
  if (Array.isArray(tipo)) return tipo.some((voce) => voce === 'Recipe')

  return false
}

/** Scende dentro @graph e dentro gli array finche' non trova un nodo Recipe. */
function cercaRicetta(valore: unknown): Nodo | null {
  if (Array.isArray(valore)) {
    for (const voce of valore) {
      const trovata = cercaRicetta(voce)
      if (trovata) return trovata
    }
    return null
  }

  if (!valore || typeof valore !== 'object') return null

  const nodo = valore as Nodo

  if (haTipoRicetta(nodo)) return nodo

  if (nodo['@graph']) return cercaRicetta(nodo['@graph'])

  return null
}

/** Ogni blocco <script type="application/ld+json"> della pagina. */
export function blocchiJsonLd(html: string): string[] {
  const blocchi: string[] = []
  const espressione =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  let trovato = espressione.exec(html)

  while (trovato !== null) {
    if (trovato[1]) blocchi.push(trovato[1])
    trovato = espressione.exec(html)
  }

  return blocchi
}

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'fonte sconosciuta'
  }
}

/**
 * Estrae la ricetta dall'HTML di una pagina. Restituisce null se la pagina non
 * dichiara nessuna ricetta, o se quello che dichiara non ha almeno un titolo e
 * un ingrediente: mezza ricetta nel catalogo e' peggio di nessuna ricetta.
 */
export function estraiRicetta(html: string, url: string): RicettaEstratta | null {
  for (const blocco of blocchiJsonLd(html)) {
    let dati: unknown

    try {
      dati = JSON.parse(blocco)
    } catch {
      // Blocco malformato: i siti ne pubblicano piu' di uno, si tira dritto.
      continue
    }

    const nodo = cercaRicetta(dati)

    if (!nodo) continue

    const titolo = primaStringa(nodo.name)
    const ingredienti = elencoDiStringhe(nodo.recipeIngredient ?? nodo.ingredients)

    if (!titolo || ingredienti.length === 0) continue

    const preparazione = minutiDaDurata(nodo.prepTime)
    const cottura = minutiDaDurata(nodo.cookTime)
    const totale =
      minutiDaDurata(nodo.totalTime) ??
      (preparazione !== null || cottura !== null ? (preparazione ?? 0) + (cottura ?? 0) : null)

    return {
      titolo,
      fonteUrl: url,
      fonteNome: dominio(url),
      immagineUrl: primaStringa(nodo.image),
      descrizione: primaStringa(nodo.description),
      minutiPreparazione: preparazione,
      minutiCottura: cottura,
      minutiTotali: totale,
      porzioni: porzioniDaValore(nodo.recipeYield),
      categoriaFonte: primaStringa(nodo.recipeCategory),
      ingredienti,
      passaggi: passaggiDaIstruzioni(nodo.recipeInstructions),
    }
  }

  return null
}
