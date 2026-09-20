import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'

import type { IngredienteRiconosciuto } from './posti'

/**
 * Leggere la lista ingredienti di una ricetta e capire cosa c'e' dentro.
 *
 * E' l'unico posto dell'app dove gira un modello, e gira **una volta per
 * ricetta**: il risultato si salva sulla riga. Non si normalizza a runtime,
 * perche' una pagina che apre e chiama un modello per mostrarti la cena e'
 * una pagina lenta e una bolletta che cresce da sola.
 *
 * Il compito e' piccolo e meccanico: "320 g di pasta di semola" deve diventare
 * l'alimento *Pasta di semola* con 320 grammi. Non serve un ragionamento, e
 * per questo gira su Haiku - il modello piu' economico - e con gli structured
 * outputs, che garantiscono la forma della risposta invece di sperarci.
 *
 * Il modello sceglie per **nome** dal vocabolario, non per id: un nome
 * inventato non si risolve e la riga diventa `sconosciuto`, che e' esattamente
 * quello che vogliamo. Un id inventato invece punterebbe a un alimento a caso
 * e nessuno se ne accorgerebbe.
 */

/**
 * Il modello che legge le liste ingredienti.
 *
 * Haiku perche' il lavoro e' estrazione, non giudizio, e perche' il conto lo
 * paga una persona sola per un'app di casa: 419 ricette costano qualche
 * centesimo invece di qualche euro. Si cambia con `MODELLO_NORMALIZZA` se un
 * giorno le righe difficili diventano troppe.
 */
const MODELLO = process.env.MODELLO_NORMALIZZA?.trim() || 'claude-haiku-4-5'

/** Senza chiave non si normalizza, e non e' un errore: si riprova domani. */
export function chiaveConfigurata(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export type VoceVocabolario = {
  id: number
  nome: string
  gruppo: string
  ruoli: string[]
  etichette: string[]
}

type RigaLetta = {
  posizione: number
  alimento: string | null
  grammi: number | null
  tipo: 'alimento' | 'libero' | 'sconosciuto'
}

const FORMATO = {
  type: 'object',
  properties: {
    righe: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          posizione: { type: 'integer' },
          alimento: {
            type: ['string', 'null'],
            description: "Il nome esatto dal vocabolario, o null se non c'e'.",
          },
          grammi: {
            type: ['number', 'null'],
            description: 'I grammi che ne vuole la ricetta, convertiti. null se non quantificabile.',
          },
          tipo: { type: 'string', enum: ['alimento', 'libero', 'sconosciuto'] },
        },
        required: ['posizione', 'alimento', 'grammi', 'tipo'],
        additionalProperties: false,
      },
    },
  },
  required: ['righe'],
  additionalProperties: false,
} as const

/**
 * Le istruzioni, insieme al vocabolario.
 *
 * Stanno in `system` e portano `cache_control`: il vocabolario e' lungo, non
 * cambia mai fra una ricetta e l'altra, e il worker ne normalizza un blocco
 * alla volta. Pagarlo per intero a ogni ricetta sarebbe buttare via nove
 * decimi del conto.
 */
function istruzioni(vocabolario: VoceVocabolario[]): string {
  const elenco = vocabolario.map((v) => `${v.nome} (${v.gruppo})`).join('\n')

  return `Traduci le righe della lista ingredienti di una ricetta italiana negli alimenti di questo vocabolario.

VOCABOLARIO
${elenco}

REGOLE
- "alimento": la riga e' uno di quelli del vocabolario. Scrivi il nome ESATTO come compare sopra, e i grammi convertiti.
- "libero": la riga insaporisce e non fa il piatto. Sale, pepe, aglio, cipolla per il soffritto, erbe aromatiche, spezie, zenzero, peperoncino, lievito, acqua, brodo, vino, mirin, aceto, limone e lime spremuti, senape, capperi, olive per condire, concentrato di pomodoro, scorze, coloranti, estratti, sriracha, wasabi, harissa. Si scrive e non si pesa: alimento null, grammi null.
  ATTENZIONE: non e' mai libero niente che porti glutine, lattosio, pesce o frutta a guscio - farina, pangrattato, panko, pane, pasta sfoglia, pasta fillo, besciamella, salsa di soia, salsa teriyaki, salsa Worcestershire, miso, panna, burro, formaggi. **Quelli cercali nel vocabolario**, ci sono quasi tutti.
- "sconosciuto": la riga e' un alimento vero ma nel vocabolario non c'e' niente che gli somigli. Alimento null.

COME CONVERTIRE
- Una quantita' scritta a pezzi **non e' un motivo per dire "sconosciuto"**: convertila e vai avanti. Una cipolla 100 g, una carota 80 g, una costa di sedano 40 g, una patata 150 g, un uovo 60 g, un pomodoro 120 g, un peperone 200 g, una zucchina 150 g, un filetto di pesce 150 g, una fetta di carne 120 g, un cucchiaio d'olio 10 g, una scatola di pelati 400 g. Quando non sai quanto pesa, stima: un numero ragionevole vale piu' di un buco.
- Ogni formato di pasta secca e' "Pasta di semola": rigatoni, paccheri, trofie, cavatelli, scialatielli, fusilli, gigli, strascinati, maltagliati, bucatini. La pasta ripiena - ravioli, tortelli, casoncelli, agnolotti - e' "Ravioli".
- Un nome di marca va al prodotto generico: Philadelphia e' "Formaggio spalmabile", le Sottilette sono "Formaggio a fette", il fiordilatte e' "Mozzarella".
- Il taglio conta meno dell'animale, e sulle etichette non cambia niente: un taglio di manzo che qui non trovi scritto (girello, biancostato, cappello del prete, campanello) e' "Spezzatino di manzo"; cosciotto, spalla e costolette d'agnello sono "Agnello".

Non forzare un abbinamento che non c'e': "sconosciuto" e' una risposta giusta, e una traduzione inventata e' peggio di un buco. Non scegliere un alimento che non sia scritto nel vocabolario qui sopra.
Rispondi una riga per ogni riga ricevuta, nello stesso ordine.`
}

/**
 * Legge le righe di una ricetta e le traduce in alimenti del vocabolario.
 *
 * Solleva se la chiave manca o se la chiamata fallisce: chi chiama decide se
 * riprovare. Non inventa un risultato parziale, perche' una ricetta
 * normalizzata a meta' sembrerebbe normalizzata.
 */
export async function leggiIngredienti(
  righe: string[],
  vocabolario: VoceVocabolario[],
): Promise<IngredienteRiconosciuto[]> {
  if (righe.length === 0) return []

  const cliente = new Anthropic()

  const risposta = await cliente.messages.parse({
    model: MODELLO,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: istruzioni(vocabolario),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: righe.map((riga, i) => `${i}. ${riga}`).join('\n'),
      },
    ],
    output_config: { format: jsonSchemaOutputFormat(FORMATO) },
  })

  const lette = risposta.parsed_output?.righe

  if (!lette) throw new Error('la normalizzazione non ha restituito righe leggibili')

  return abbinaAlVocabolario(righe, lette as RigaLetta[], vocabolario)
}

/**
 * Dalle righe lette agli alimenti veri.
 *
 * Separata dalla chiamata apposta: e' la parte che puo' sbagliare in modo
 * silenzioso - un nome che non esiste, una riga in meno, una posizione fuori
 * ordine - e si prova senza spendere niente.
 */
export function abbinaAlVocabolario(
  righe: string[],
  lette: RigaLetta[],
  vocabolario: VoceVocabolario[],
): IngredienteRiconosciuto[] {
  const perNome = new Map(vocabolario.map((v) => [v.nome.toLowerCase(), v]))

  // Le stesse parole in un altro ordine sono lo stesso alimento. Il modello
  // a volte scrive "olio di oliva extravergine" perche' cosi' era scritto
  // nella ricetta, e il vocabolario dice "Olio extravergine di oliva": prima
  // quella riga finiva fra le sconosciute, e con lei cadeva tutta la ricetta.
  const perParole = new Map(vocabolario.map((v) => [parole(v.nome), v]))

  // Il terzo livello, e quello che riscatta piu' ricette: singolari e plurali.
  // Il vocabolario dice "Cipolla" e le ricette scrivono "Cipolle", dice
  // "Carote" e la ricetta scrive "Carota". Erano righe sconosciute su alimenti
  // che stavano li' da sempre, e una riga sconosciuta fa cadere la ricetta
  // intera.
  const perRadice = new Map(vocabolario.map((v) => [radice(v.nome), v]))
  const perPosizione = new Map(lette.map((l) => [l.posizione, l]))

  return righe.map((grezza, i) => {
    const letta = perPosizione.get(i)
    const trovato = letta?.alimento
      ? (perNome.get(letta.alimento.toLowerCase()) ??
        perParole.get(parole(letta.alimento)) ??
        perRadice.get(radice(letta.alimento)))
      : undefined

    // Una riga saltata dal modello, o un nome che nel vocabolario non c'e':
    // e' sconosciuta, non e' libera. La differenza conta - "libera" vuol dire
    // "l'ho capita e non pesa", e da' per buone le etichette della ricetta.
    if (!letta) return sconosciuto(grezza)
    if (letta.tipo === 'libero') {
      return { alimentoId: null, nome: grezza, gruppo: null, ruolo: null, grammi: null, etichette: [], tipo: 'libero' as const }
    }
    if (!trovato) return sconosciuto(grezza)

    return {
      alimentoId: trovato.id,
      nome: trovato.nome,
      gruppo: trovato.gruppo,
      ruolo: trovato.ruoli[0] ?? null,
      grammi: letta.grammi,
      // Le etichette le porta l'alimento, non la ricetta: e' la regola che
      // regge tutto - "un sito che dichiara senza glutine non e' attendibile".
      etichette: trovato.etichette,
      tipo: 'alimento' as const,
    }
  })
}

/**
 * Le parole di un nome, in ordine alfabetico.
 *
 * Serve a far cadere "Olio extravergine di oliva" e "olio di oliva
 * extravergine" sulla stessa chiave. Due voci del vocabolario con le stesse
 * parole sarebbero un doppione, e un test gia' vieta i doppioni: quindi qui
 * non si rischia di scambiare un alimento per un altro.
 */
export function parole(nome: string): string {
  return (
    senzaAccenti(nome.toLowerCase())
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      // Via le paroline: articoli e preposizioni non distinguono un alimento
      // da un altro, e sono quelle che cambiano fra un sito e l'altro. "Olio
      // extravergine d'oliva" e "Olio extravergine di oliva" differivano solo
      // per "d" contro "di", e tanto bastava a perdere la ricetta.
      //
      // I numeri corti restano: li' la differenza e' tutta. Buttandoli,
      // "Yogurt greco 5%" e "Yogurt greco 0%" cadevano sulla stessa chiave, e
      // il piano ti avrebbe dato l'uno per l'altro. L'ha preso il test dei
      // doppioni.
      .filter((p) => p.length > 2 || /\d/.test(p))
      .sort()
      .join(' ')
  )
}

/**
 * Via gli accenti.
 *
 * Il vocabolario scrive "Baccala" e le ricette scrivono "Baccala'": la stessa
 * parola, e per l'abbinamento erano due alimenti diversi.
 */
function senzaAccenti(nome: string): string {
  return nome.normalize('NFD').replace(/\p{Mn}/gu, '')
}

/**
 * Le parole ridotte alla radice, per far cadere singolare e plurale insieme.
 *
 * In italiano il plurale cambia l'ultima vocale e basta - cipolla/cipolle,
 * carota/carote, pomodoro/pomodori - quindi si toglie la vocale finale e le
 * due forme diventano la stessa chiave.
 *
 * E' il livello piu' largo dei tre, e si usa per ultimo: un test controlla che
 * nel vocabolario non ci siano due alimenti con la stessa radice, perche' se
 * ci fossero questo scambierebbe l'uno per l'altro senza dirlo.
 *
 * Le parole corte e quelle coi numeri restano intere: "0%" e "5%" sono
 * esattamente la differenza fra due yogurt.
 */
export function radice(nome: string): string {
  return parole(nome)
    .split(' ')
    .map((p) => (p.length > 3 && !/\d/.test(p) ? p.replace(/[aeio]$/, '') : p))
    .sort()
    .join(' ')
}

function sconosciuto(grezza: string): IngredienteRiconosciuto {
  return {
    alimentoId: null,
    nome: grezza,
    gruppo: null,
    ruolo: null,
    grammi: null,
    etichette: [],
    tipo: 'sconosciuto',
  }
}
