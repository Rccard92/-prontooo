import type { FasciaPasto, RuoloPasto } from '@prontooo/db/alimenti'

/**
 * Come e' fatto un pasto.
 *
 * Non e' una ricetta: e' l'elenco dei ruoli da riempire. Un pranzo vuole una
 * base, una proteina, una verdura e un grasso; una colazione vuole un
 * latticino, un cereale e qualcosa sopra. Gli schemi sono la struttura, il
 * vocabolario degli alimenti e' il contenuto.
 *
 * `peso` e' il moltiplicatore sulla porzione tipica dell'alimento. Serve a
 * dire "a cena la base e' piu' piccola" senza duplicare il vocabolario.
 */
export type PostoSchema = {
  ruolo: RuoloPasto
  peso?: number
  /** Un posto facoltativo salta quando non c'e' un alimento ammesso. */
  facoltativo?: boolean
}

export type SchemaPasto = {
  id: string
  nome: string
  fasce: FasciaPasto[]
  posti: PostoSchema[]
}

export const SCHEMI: SchemaPasto[] = [
  {
    id: 'colazione_yogurt',
    nome: 'Yogurt e cereali',
    fasce: ['colazione'],
    posti: [
      { ruolo: 'latticino' },
      { ruolo: 'cereale_colazione' },
      { ruolo: 'semi', facoltativo: true },
      { ruolo: 'frutta', peso: 0.7, facoltativo: true },
    ],
  },
  {
    id: 'colazione_pane',
    nome: 'Pane e spalmabile',
    fasce: ['colazione'],
    posti: [
      { ruolo: 'cereale_colazione' },
      { ruolo: 'spalmabile' },
      { ruolo: 'latticino', facoltativo: true },
    ],
  },
  {
    id: 'spuntino_frutta',
    nome: 'Frutta',
    fasce: ['spuntino', 'merenda'],
    posti: [{ ruolo: 'frutta' }],
  },
  {
    id: 'spuntino_secco',
    nome: 'Qualcosa di secco',
    fasce: ['spuntino', 'merenda'],
    posti: [{ ruolo: 'snack' }],
  },
  {
    id: 'pasto_completo',
    nome: 'Piatto completo',
    fasce: ['pranzo', 'cena'],
    posti: [
      { ruolo: 'base' },
      { ruolo: 'proteina' },
      { ruolo: 'verdura' },
      { ruolo: 'grasso' },
    ],
  },
  {
    id: 'pasto_proteina_verdura',
    nome: 'Proteina e verdura',
    fasce: ['pranzo', 'cena'],
    posti: [
      { ruolo: 'proteina', peso: 1.2 },
      { ruolo: 'verdura', peso: 1.2 },
      { ruolo: 'base', peso: 0.5, facoltativo: true },
      { ruolo: 'grasso' },
    ],
  },
  {
    id: 'pasto_unico',
    nome: 'Piatto unico',
    fasce: ['pranzo', 'cena'],
    posti: [
      { ruolo: 'base' },
      { ruolo: 'verdura' },
      { ruolo: 'grasso' },
    ],
  },
]

export function schemiPerFascia(fascia: FasciaPasto): SchemaPasto[] {
  return SCHEMI.filter((s) => s.fasce.includes(fascia))
}
