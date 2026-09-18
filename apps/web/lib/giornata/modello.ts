import type { Nutrienti } from '@prontooo/db/alimenti'

export const STATI = ['previsto', 'mangiato', 'saltato', 'fuori_piano'] as const
export type Stato = (typeof STATI)[number]

export const TIPI_GIORNO = ['standard', 'on', 'off'] as const
export type TipoGiorno = (typeof TIPI_GIORNO)[number]

export const NOME_TIPO_GIORNO: Record<TipoGiorno, string> = {
  standard: 'Giornata normale',
  on: 'Giorno di allenamento',
  off: 'Giorno di riposo',
}

/**
 * Quanto si sposta ogni ruolo a seconda del giorno.
 *
 * ON: piu' base, meno grassi aggiunti. OFF: meno base, piu' verdura. La
 * proteina non si tocca in nessuno dei due: e' il ruolo che si difende.
 */
export const MOLTIPLICATORI: Record<TipoGiorno, Partial<Record<string, number>>> = {
  standard: {},
  on: { base: 1.25, grasso: 0.8 },
  off: { base: 0.75, verdura: 1.3 },
}

export type Componente = {
  ruolo: string
  alimentoId: number | null
  nome: string
  quantita: number
  unita: string
}

export type Consumato = {
  alimentoId: number | null
  nome: string
  quantita: number
  unita: string
  kcal: number
  proteine: number
  carboidrati: number
  grassi: number
}

/** I pavimenti sotto cui la ricalibrazione non scende: un pasto resta un pasto. */
export const MINIMI_KCAL: Record<string, number> = {
  colazione: 200,
  spuntino: 80,
  pranzo: 350,
  merenda: 80,
  cena: 350,
}

/** Quanto pesa ogni fascia sull'obiettivo del giorno, quando va ridistribuito. */
export function quotaFascia(fascia: string): number {
  return MINIMI_KCAL[fascia] ?? 200
}

export function nutrientiConsumati(voci: Consumato[]): Nutrienti {
  return voci.reduce(
    (t, v) => ({
      kcal: t.kcal + v.kcal,
      proteine: t.proteine + v.proteine,
      carboidrati: t.carboidrati + v.carboidrati,
      grassi: t.grassi + v.grassi,
      fibre: t.fibre,
    }),
    { kcal: 0, proteine: 0, carboidrati: 0, grassi: 0, fibre: 0 },
  )
}
