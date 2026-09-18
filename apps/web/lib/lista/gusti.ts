import { asc, inArray } from 'drizzle-orm'

import { alimenti, db } from '@prontooo/db'

import { FASCE } from '../ricette/fasce'

import type { VoceDaSalvare } from './importa'

/**
 * Dalla spunta dei gusti alla lista degli ingredienti.
 *
 * E' la strada senza nutrizionista. Tu dici cosa ti piace, diviso per
 * categoria, e la lista si costruisce da sola: ogni alimento finisce **solo
 * nelle fasce che il vocabolario gli concede**, e li' dentro fa da alternativa
 * agli altri che coprono lo stesso ruolo.
 *
 * E' questo che tiene la fettina e i broccoli lontani dalla colazione. Non e'
 * un filtro messo dopo: la fettina non entra proprio nella colazione, perche'
 * nel vocabolario le sue fasce sono pranzo e cena e basta.
 */
export type AlimentoScelto = {
  id: number
  nome: string
  gruppo: string
  ruoli: string[]
  fasce: string[]
  quantita: number
  unita: string
}

/** L'ordine in cui i ruoli compaiono dentro un pasto. */
const ORDINE_RUOLI = [
  'base',
  'cereale_colazione',
  'proteina',
  'latticino',
  'verdura',
  'grasso',
  'spalmabile',
  'semi',
  'frutta',
  'snack',
]

function ruoloDi(alimento: AlimentoScelto): string {
  return alimento.ruoli[0] ?? 'base'
}

/**
 * Le voci della lista, a partire dagli alimenti spuntati.
 *
 * Gli alimenti dello stesso ruolo, nella stessa fascia, finiscono nella stessa
 * riga: sono alternative, e il compositore ne pesca una. Le quantita' sono le
 * porzioni tipiche del vocabolario, e si correggono a mano dopo.
 */
export function vociDaGusti(scelti: AlimentoScelto[]): VoceDaSalvare[] {
  const voci: VoceDaSalvare[] = []

  for (const fascia of FASCE) {
    const ammessi = scelti.filter((a) => a.fasce.includes(fascia))

    if (ammessi.length === 0) continue

    const perRuolo = new Map<string, AlimentoScelto[]>()

    for (const alimento of ammessi) {
      const ruolo = ruoloDi(alimento)

      perRuolo.set(ruolo, [...(perRuolo.get(ruolo) ?? []), alimento])
    }

    const ruoli = [...perRuolo.keys()].sort((a, b) => {
      const primo = ORDINE_RUOLI.indexOf(a)
      const secondo = ORDINE_RUOLI.indexOf(b)

      // I ruoli che non conosciamo vanno in fondo, in ordine alfabetico.
      if (primo === -1 && secondo === -1) return a.localeCompare(b, 'it')
      if (primo === -1) return 1
      if (secondo === -1) return -1

      return primo - secondo
    })

    ruoli.forEach((ruolo, riga) => {
      const alternative = [...(perRuolo.get(ruolo) ?? [])].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'it'),
      )

      alternative.forEach((alimento, ordine) => {
        voci.push({
          fascia,
          riga,
          ordine,
          testo: alimento.nome,
          quantita: alimento.quantita,
          unita: alimento.unita,
          alimentoId: alimento.id,
        })
      })
    })
  }

  return voci
}

/** Gli alimenti scelti, letti dal vocabolario. Gli id sconosciuti si ignorano. */
export async function alimentiScelti(ids: number[]): Promise<AlimentoScelto[]> {
  const unici = [...new Set(ids)].filter((id) => Number.isInteger(id))

  if (unici.length === 0) return []

  const righe = await db()
    .select({
      id: alimenti.id,
      nome: alimenti.nome,
      gruppo: alimenti.gruppo,
      ruoli: alimenti.ruoli,
      fasce: alimenti.fasce,
      quantita: alimenti.quantita,
      unita: alimenti.unita,
    })
    .from(alimenti)
    .where(inArray(alimenti.id, unici))
    .orderBy(asc(alimenti.nome))

  return righe
}

/**
 * Le macro-categorie, nell'ordine in cui si spuntano.
 *
 * Sono i gruppi del vocabolario messi in un ordine che ha senso leggere, con
 * un nome che si capisce: nel database un alimento e' di gruppo `frutta_secca`,
 * a schermo sta sotto "Frutta secca e semi".
 */
export const CATEGORIE: { gruppo: string; nome: string; spiega: string }[] = [
  { gruppo: 'carne', nome: 'Carne', spiega: 'Il secondo di pranzo e cena.' },
  { gruppo: 'pesce', nome: 'Pesce', spiega: 'Anche in scatola: conta uguale.' },
  { gruppo: 'uova', nome: 'Uova', spiega: 'Proteina veloce, a ogni ora.' },
  { gruppo: 'legume', nome: 'Legumi', spiega: 'Proteina e carboidrato insieme.' },
  { gruppo: 'latticino', nome: 'Latte e formaggi', spiega: 'Colazione, merenda, secondo.' },
  { gruppo: 'cereale', nome: 'Cereali e pasta', spiega: 'La base del piatto.' },
  { gruppo: 'pane', nome: 'Pane e sostituti', spiega: 'Quello che ci accompagni.' },
  { gruppo: 'tubero', nome: 'Patate', spiega: 'Base, non contorno.' },
  { gruppo: 'verdura', nome: 'Verdura', spiega: 'Spunta larga: qui si varia ogni giorno.' },
  { gruppo: 'frutta', nome: 'Frutta', spiega: 'Spuntini e fine pasto.' },
  { gruppo: 'frutta_secca', nome: 'Frutta secca e semi', spiega: 'Pochi grammi, molte calorie.' },
  { gruppo: 'grasso', nome: 'Condimenti', spiega: "L'olio serve: senza, il piatto non sta in piedi." },
  { gruppo: 'dolce', nome: 'Dolce', spiega: 'Marmellata, miele, cioccolato.' },
  { gruppo: 'bevanda', nome: 'Bevande', spiega: 'Latte vegetale, succhi.' },
]
