import { type Fascia, eFascia } from '../ricette/fasce'

/**
 * Lo schema del pasto: quanti posti ha un piatto, e chi ci puo' stare.
 *
 * E' nato da una colazione vera che l'app aveva prodotto: torta fatta in casa,
 * salmone affumicato, yogurt, avocado, marmellata, noci, mango e granita
 * siciliana. Otto alimenti, tutti leciti, nessuno al posto sbagliato secondo
 * le fasce - e non era una colazione, era un inventario.
 *
 * Il difetto non era la scelta di un alimento, era il conteggio: il
 * compositore pescava **una cosa da ogni riga della fascia**, e le righe sono
 * una per ruolo. Chi spunta nove ruoli a colazione si ritrovava nove alimenti
 * nel piatto. Piu' spunti, peggio mangi: esattamente il contrario di quello
 * che deve fare la spunta.
 *
 * Adesso il numero dei posti lo decide il pasto, non la lista. Un pranzo ha
 * una base, una proteina, una verdura e un grasso, e chi ha spuntato quaranta
 * cose si vede quelle quattro, diverse ogni giorno. La lista dice **cosa puo'
 * entrare**; lo schema dice **quanti ne entrano**.
 */
export type Posto = {
  /** I ruoli che possono riempirlo, in ordine di preferenza. */
  ruoli: string[]
  /**
   * Un posto obbligatorio che resta vuoto e' una cosa da dire: o non hai
   * spuntato niente per quel ruolo, o quello che hai spuntato e' fuori
   * stagione. Uno facoltativo che resta vuoto e' semplicemente un piatto
   * piu' corto.
   */
  obbligatorio?: boolean
  /** Come si chiama quando l'app deve dire che manca. */
  nome: string
}

/**
 * I posti di ogni fascia.
 *
 * Colazione e cene hanno forme diverse e non e' un dettaglio: a colazione la
 * proteina e' un latticino e la base e' un cereale da latte, a cena la base e'
 * un contorno di carboidrati e la proteina e' un secondo. Lo stesso alimento
 * puo' coprire ruoli diversi, ma il **posto** no.
 */
export const SCHEMA: Record<Fascia, Posto[]> = {
  colazione: [
    { nome: 'la base', ruoli: ['cereale_colazione', 'base'], obbligatorio: true },
    { nome: 'il latticino', ruoli: ['latticino', 'proteina'], obbligatorio: true },
    { nome: 'la frutta', ruoli: ['frutta'] },
    { nome: 'quello che ci metti sopra', ruoli: ['spalmabile', 'semi'] },
  ],
  spuntino: [
    { nome: 'la frutta', ruoli: ['frutta', 'snack'], obbligatorio: true },
    { nome: 'quello che ci accompagni', ruoli: ['semi', 'latticino'] },
  ],
  pranzo: [
    { nome: 'la base', ruoli: ['base'], obbligatorio: true },
    { nome: 'la proteina', ruoli: ['proteina'], obbligatorio: true },
    { nome: 'la verdura', ruoli: ['verdura'], obbligatorio: true },
    { nome: 'il condimento', ruoli: ['grasso'] },
  ],
  merenda: [
    { nome: 'la frutta', ruoli: ['frutta', 'snack'], obbligatorio: true },
    { nome: 'quello che ci accompagni', ruoli: ['semi', 'latticino', 'cereale_colazione'] },
  ],
  cena: [
    { nome: 'la base', ruoli: ['base'], obbligatorio: true },
    { nome: 'la proteina', ruoli: ['proteina'], obbligatorio: true },
    { nome: 'la verdura', ruoli: ['verdura'], obbligatorio: true },
    { nome: 'il condimento', ruoli: ['grasso'] },
  ],
}

export function postiDi(fascia: string): Posto[] {
  return eFascia(fascia) ? SCHEMA[fascia] : []
}

/** Una riga della lista, ridotta a quello che serve per riempire un posto. */
export type RigaDisponibile<T> = { ruolo: string; voci: T[] }

export type PostoRiempito<T> = { posto: Posto; scelta: T | null }

/**
 * Assegna una riga della lista a ogni posto del pasto.
 *
 * Due regole, e sono quelle che tengono il piatto insieme:
 *
 * 1. **Una riga sola per posto, e una sola volta.** Se il latticino e' gia'
 *    andato a riempire il posto della colazione, non torna anche come
 *    "quello che ci metti sopra": sarebbe yogurt con lo yogurt.
 * 2. **I ruoli in ordine.** Il posto prova prima il ruolo che preferisce; il
 *    secondo e' un ripiego. Cosi' a colazione il pane arriva solo se non hai
 *    spuntato nessun cereale da latte, invece di contenderselo a sorte.
 *
 * Non sceglie **quale** alimento: quello lo fa `pesca`, che sa dei pesi, delle
 * abitudini e delle offerte. Qui si decide solo la forma del piatto, ed e'
 * per questo che la funzione si prova senza database.
 */
export function riempiPosti<T>(
  posti: Posto[],
  righe: RigaDisponibile<T>[],
  pesca: (voci: T[]) => T | null,
): PostoRiempito<T>[] {
  const usate = new Set<RigaDisponibile<T>>()

  return posti.map((posto) => {
    for (const ruolo of posto.ruoli) {
      const candidate = righe.filter((r) => r.ruolo === ruolo && !usate.has(r) && r.voci.length > 0)

      if (candidate.length === 0) continue

      // Le righe dello stesso ruolo si mettono insieme prima di pescare: sono
      // alternative fra loro, e pescare dal mucchio le tratta da pari invece
      // di far vincere sempre la prima.
      const scelta = pesca(candidate.flatMap((r) => r.voci))

      if (scelta === null) continue

      for (const riga of candidate) {
        if (riga.voci.includes(scelta)) {
          usate.add(riga)
          break
        }
      }

      return { posto, scelta }
    }

    return { posto, scelta: null }
  })
}
