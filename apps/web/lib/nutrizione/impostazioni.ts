import type { Etichetta, FasciaPasto, RuoloPasto } from '@prontooo/db/alimenti'

/**
 * Le impostazioni nutrizionali.
 *
 * Non tolgono alimenti - quello lo fanno le esclusioni - ma spostano le
 * proporzioni fra i ruoli. La proteica alza la proteina e abbassa la base,
 * quella per dimagrire taglia i grassi aggiunti. Se ne sceglie una sola.
 */
export type Impostazione = {
  id: string
  nome: string
  spiega: string
  /** Moltiplicatori sulla porzione, per ruolo. */
  pesi: Partial<Record<RuoloPasto, number>>
  /** Moltiplicatori che valgono solo in una fascia. */
  pesiPerFascia?: Partial<Record<FasciaPasto, Partial<Record<RuoloPasto, number>>>>
  /** Etichette che questa impostazione esclude a prescindere. */
  escludi?: Etichetta[]
  /** Etichette da preferire quando si sceglie fra piu' alimenti ammessi. */
  preferisci?: Etichetta[]
}

export const IMPOSTAZIONI: Impostazione[] = [
  {
    id: 'equilibrata',
    nome: 'Equilibrata',
    spiega: 'Porzioni standard, un po’ di tutto a ogni pasto.',
    pesi: {},
  },
  {
    id: 'proteica',
    nome: 'Proteica',
    spiega: 'Più proteina, meno base. Spuntini che saziano.',
    pesi: { proteina: 1.3, base: 0.7 },
    preferisci: ['proteico'],
  },
  {
    id: 'dimagrire',
    nome: 'Per dimagrire',
    spiega: 'Meno grassi aggiunti e meno base, più verdura. Niente fritti.',
    pesi: { grasso: 0.5, base: 0.7, verdura: 1.4 },
    escludi: ['fritto'],
  },
  {
    id: 'piu_verdure',
    nome: 'Più verdure',
    spiega: 'La verdura raddoppia, la base si ridimensiona.',
    pesi: { verdura: 1.6, base: 0.8 },
  },
  {
    id: 'leggera_sera',
    nome: 'Leggera la sera',
    spiega: 'Pranzo normale, cena senza base e con più verdura.',
    pesi: {},
    pesiPerFascia: { cena: { base: 0.4, verdura: 1.4, proteina: 1.1 } },
  },
]

export function impostazione(id: string): Impostazione {
  return IMPOSTAZIONI.find((i) => i.id === id) ?? IMPOSTAZIONI[0]!
}

/** Le esclusioni che si possono spuntare nel wizard, in ordine di frequenza. */
export const ESCLUSIONI: { id: Etichetta; nome: string; spiega: string }[] = [
  { id: 'lattosio', nome: 'Senza lattosio', spiega: 'Latte, yogurt, formaggi freschi, e i salumi che lo contengono' },
  { id: 'glutine', nome: 'Senza glutine', spiega: 'Grano, orzo, farro, avena e tutto quello che ne deriva' },
  { id: 'pane', nome: 'Senza pane', spiega: 'Pane, fette biscottate, crackers, grissini, piadine' },
  { id: 'maiale', nome: 'Senza maiale', spiega: 'Carne di maiale e salumi che ne derivano' },
  { id: 'carne_rossa', nome: 'Senza carne rossa', spiega: 'Manzo, vitello, maiale, cavallo' },
  { id: 'pesce', nome: 'Senza pesce', spiega: 'Pesce, molluschi e crostacei' },
  { id: 'uova', nome: 'Senza uova', spiega: 'Uova intere e albume' },
  { id: 'frutta_guscio', nome: 'Senza frutta a guscio', spiega: 'Mandorle, noci, nocciole e le creme che le contengono' },
  { id: 'zuccheri', nome: 'Senza zuccheri aggiunti', spiega: 'Miele, marmellate zuccherate, cioccolato, biscotti' },
]
