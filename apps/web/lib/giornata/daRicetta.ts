import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'

import { type Alimento, alimenti, db, ricettaIngredienti, ricette } from '@prontooo/db'
import { SENZA_LATTOSIO } from '@prontooo/db/alimenti'

import { type Nutrienti, nutrientiDi, sommaNutrienti } from '../lista/modello'
import { eFascia } from '../ricette/fasce'

import type { Componente } from './modello'

/**
 * Un pasto fatto **con la ricetta**, non con la ricetta piegata addosso.
 *
 * E' il contrario di come funzionava prima, e il motivo e' un piatto che si
 * chiamava "Baccala' alle verdure" e dentro aveva i calamari. Prima si
 * prendeva la *forma* della ricetta - base, proteina, verdura, grasso - e ci
 * si infilavano i tuoi alimenti: il titolo e la foto restavano quelli della
 * ricetta, il contenuto diventava un altro piatto.
 *
 * Adesso la ricetta resta se stessa. I suoi ingredienti sono i suoi, e per
 * farli tornare col tuo fabbisogno si **scalano in proporzione**: se la
 * ricetta fa 2400 kcal per quattro e a te ne spettano 700, tutto si
 * moltiplica per 0,29. Il baccala' resta baccala', diventa di meno.
 *
 * La proporzione e' l'unica cosa che si puo' toccare senza rompere il piatto.
 * Tagliare un ingrediente piu' di un altro - come fa la ricalibrazione quando
 * sfori - andrebbe bene per un elenco di componenti, non per una ricetta:
 * meno olio e stesso pesce non e' piu' quella ricetta.
 */
export type PastoDaRicetta = {
  /** L'id gia' col prefisso, pronto per `giornata_pasti.ricetta_libro`. */
  ricetta: string
  componenti: Componente[]
  /**
   * I nutrienti della ricetta **come sta scritta**, prima di scalarla.
   *
   * Servono a due cose: sapere di quanto scalare, e poi sapere cosa e'
   * finito nel piatto. Il secondo non e' scontato - gli alimenti di una
   * ricetta non stanno nella tua lista, e chi somma la giornata guarda li'.
   */
  nutrienti: Nutrienti
}

/** Lo stesso prefisso di `scelta.ts`: gli id dei due mondi non si mescolano. */
const DAL_CATALOGO = 'catalogo-'

/** Quante candidate guardare prima di arrendersi, per fascia. */
const DA_PROVARE = 12

type Candidata = { id: number; titolo: string; fasce: string[]; etichette: string[] }

/**
 * Le ricette che possono reggere un pasto, gia' scremate dalle esclusioni.
 *
 * Il filtro sulle etichette e' la rete di sicurezza vera, ed e' affidabile per
 * un motivo solo: quelle etichette sono la somma degli alimenti riconosciuti
 * dalla normalizzazione, **non** i tag del sito. Un sito che scrive "senza
 * glutine" non conta niente qui dentro.
 */
async function candidate(): Promise<Candidata[]> {
  return db()
    .select({
      id: ricette.id,
      titolo: ricette.titolo,
      fasce: ricette.fasce,
      etichette: ricette.etichette,
    })
    .from(ricette)
    .where(and(isNotNull(ricette.normalizzataIl), sql`jsonb_array_length(${ricette.posti}) > 0`))
}

type RigaIngrediente = { alimento: Alimento | null; grammi: number }

/** Gli ingredienti veri di una ricetta, con dentro di che contare le calorie. */
async function ingredientiDi(ricettaId: number): Promise<RigaIngrediente[]> {
  const righe = await db()
    .select({ alimento: alimenti, grammi: ricettaIngredienti.grammi })
    .from(ricettaIngredienti)
    .leftJoin(alimenti, eq(alimenti.id, ricettaIngredienti.alimentoId))
    .where(eq(ricettaIngredienti.ricettaId, ricettaId))
    .orderBy(asc(ricettaIngredienti.posizione))

  return righe.map((r) => ({ alimento: r.alimento, grammi: Number(r.grammi ?? 0) }))
}

/**
 * La ricetta riscritta col gemello senza lattosio dove si puo'.
 *
 * Vale sia per chi il lattosio lo attenua sia per chi lo esclude, e non e'
 * una scorciatoia: una ricetta in cui la mozzarella e' diventata mozzarella
 * senza lattosio **il lattosio non ce l'ha piu'**. Rifiutarla lo stesso
 * vorrebbe dire togliere un piatto che va benissimo.
 *
 * Dove il gemello non c'e' - la ricotta di un certo tipo, la panna - non si
 * inventa niente: l'ingrediente resta com'e', l'etichetta resta, e se il
 * lattosio e' fra le esclusioni quella ricetta viene scartata dopo.
 */
function senzaLattosio(
  righe: RigaIngrediente[],
  gemelli: Map<string, Alimento>,
): RigaIngrediente[] {
  return righe.map((riga) => {
    const gemello = riga.alimento === null ? undefined : gemelli.get(riga.alimento.nome)

    return gemello ? { ...riga, alimento: gemello } : riga
  })
}

/** I gemelli delattosati che esistono davvero nel vocabolario. */
async function leggiGemelli(): Promise<Map<string, Alimento>> {
  const nomi = [...new Set(Object.values(SENZA_LATTOSIO))]

  if (nomi.length === 0) return new Map()

  const righe = await db().select().from(alimenti).where(inArray(alimenti.nome, nomi))
  const perNome = new Map(righe.map((r) => [r.nome, r]))
  const gemelli = new Map<string, Alimento>()

  for (const [originale, delattosato] of Object.entries(SENZA_LATTOSIO)) {
    const trovato = perNome.get(delattosato)

    if (trovato) gemelli.set(originale, trovato)
  }

  return gemelli
}

/**
 * Sceglie una ricetta per ogni fascia e ne prende gli ingredienti veri.
 *
 * Le esclusioni si controllano **sugli ingredienti finali**, dopo la
 * sostituzione del lattosio, non sull'etichetta salvata. E' la differenza fra
 * "questa ricetta aveva la mozzarella" e "questo piatto ha il lattosio": la
 * prima si puo' aggiustare, la seconda no.
 *
 * `evitate` tiene fuori quelle gia' proposte oggi: lo stesso piatto a pranzo e
 * a cena e' la cosa che nessun piano dovrebbe fare.
 */
export async function pastiDalleRicette(
  fasce: string[],
  esclusioni: string[],
  cambiaIlLattosio: boolean,
  /** Ricette da non riproporre: quelle di oggi, o quella che stai cambiando. */
  daSaltare: number[] = [],
): Promise<{ pasti: Map<string, PastoDaRicetta>; alimenti: Map<number, Alimento> }> {
  const usati = new Map<number, Alimento>()
  const volute = fasce.filter(eFascia)

  if (volute.length === 0) return { pasti: new Map(), alimenti: usati }

  const [tutte, gemelli] = await Promise.all([
    candidate(),
    cambiaIlLattosio ? leggiGemelli() : Promise.resolve(new Map<string, Alimento>()),
  ])

  const esclusi = new Set(esclusioni)
  const evitate = new Set<number>(daSaltare)
  const esito = new Map<string, PastoDaRicetta>()

  for (const fascia of volute) {
    // Si guarda anche l'etichetta salvata, ma solo per scartare in fretta il
    // grosso: quella vera e' la verifica sugli ingredienti, piu' sotto.
    const perQuestaFascia = tutte.filter(
      (r) =>
        r.fasce.includes(fascia) &&
        !evitate.has(r.id) &&
        r.etichette.every((e) => !esclusi.has(e) || (e === 'lattosio' && cambiaIlLattosio)),
    )

    // Alla cieca fra quelle buone: se prendessi sempre la prima, con gli
    // stessi dati mangeresti lo stesso piatto per sempre.
    const mucchio = [...perQuestaFascia].sort(() => Math.random() - 0.5).slice(0, DA_PROVARE)

    for (const candidata of mucchio) {
      const righe = senzaLattosio(await ingredientiDi(candidata.id), gemelli)

      // La verifica che conta: quello che e' rimasto nel piatto, non quello
      // che la ricetta aveva scritto prima della sostituzione.
      const etichette = new Set(righe.flatMap((r) => r.alimento?.etichette ?? []))

      if ([...etichette].some((e) => esclusi.has(e))) continue

      const pesabili = righe.filter((r) => r.alimento !== null && r.grammi > 0)

      // Una ricetta senza ingredienti pesabili non si puo' scalare: non si sa
      // da che numero partire.
      if (pesabili.length === 0) continue

      const nutrienti = sommaNutrienti(pesabili.map((r) => nutrientiDi(r.alimento, r.grammi)))

      if (nutrienti.kcal <= 0) continue

      const componenti: Componente[] = pesabili.map((r) => ({
        ruolo: r.alimento?.ruoli?.[0] ?? 'base',
        alimentoId: r.alimento?.id ?? null,
        nome: r.alimento?.nome ?? 'Da collegare',
        quantita: r.grammi,
        unita: 'g',
      }))

      for (const riga of pesabili) {
        if (riga.alimento) usati.set(riga.alimento.id, riga.alimento)
      }

      evitate.add(candidata.id)
      esito.set(fascia, { ricetta: `${DAL_CATALOGO}${candidata.id}`, componenti, nutrienti })
      break
    }
  }

  return { pasti: esito, alimenti: usati }
}

/**
 * Gli stessi ingredienti, in proporzione.
 *
 * Tutti per lo stesso fattore, e non e' pigrizia: una ricetta si scala intera.
 * Tagliare l'olio piu' del pesce - come fa `scalaComponenti` quando devi
 * rientrare da uno sforo - va bene per un elenco di componenti, che e' roba
 * nostra. Su una ricetta di qualcun altro vuol dire cambiargliela.
 *
 * Il fattore si tiene entro limiti ragionevoli: sotto un quinto o sopra il
 * doppio non stai piu' scalando una ricetta, ne stai cucinando un'altra.
 */
export function scalaRicetta(componenti: Componente[], fattore: number): Componente[] {
  const usato = Math.min(Math.max(fattore, 0.2), 2)

  if (Math.abs(usato - 1) < 0.05) return componenti

  return componenti.map((c) => ({
    ...c,
    quantita: c.quantita === 0 ? 0 : Math.max(5, Math.round((c.quantita * usato) / 5) * 5),
  }))
}

/** Il numero dentro `catalogo-812`, o null se non e' una ricetta del catalogo. */
export function numeroDiRicetta(id: string | null | undefined): number | null {
  if (!id?.startsWith(DAL_CATALOGO)) return null

  const coda = id.slice(DAL_CATALOGO.length)

  // La coda vuota non e' lo zero: `Number('')` fa 0, e senza questo controllo
  // "catalogo-" sarebbe finito in una query come id 0.
  if (!/^\d+$/.test(coda)) return null

  const numero = Number(coda)

  return numero > 0 ? numero : null
}
