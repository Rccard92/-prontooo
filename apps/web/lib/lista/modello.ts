import type { Alimento, ListaVoce } from '@prontooo/db'
import { type Nutrienti, NUTRIENTI_ZERO, perQuantita, sommaNutrienti } from '@prontooo/db/alimenti'

export const GIORNI_LISTA = ['standard', 'on', 'off'] as const
export type GiornoLista = (typeof GIORNI_LISTA)[number]

export const NOME_GIORNO_LISTA: Record<GiornoLista, string> = {
  standard: 'Tutti i giorni',
  on: 'Giorno di allenamento',
  off: 'Giorno di riposo',
}

/** Una riga della lista: le alternative ammesse per un posto del pasto. */
export type Riga = {
  riga: number
  voci: (ListaVoce & { alimento: Alimento | null })[]
}

/** Raggruppa le voci di una fascia nelle sue righe di alternative. */
export function righeDi(voci: (ListaVoce & { alimento: Alimento | null })[]): Riga[] {
  const per = new Map<number, Riga>()

  for (const voce of voci) {
    const esistente = per.get(voce.riga)

    if (esistente) esistente.voci.push(voce)
    else per.set(voce.riga, { riga: voce.riga, voci: [voce] })
  }

  return [...per.values()].sort((a, b) => a.riga - b.riga)
}

function numero(valore: string | null): number {
  const n = Number(valore)

  return Number.isFinite(n) ? n : 0
}

/** I nutrienti di una quantita' di un alimento. Zero se non li conosciamo. */
export function nutrientiDi(alimento: Alimento | null, quantita: number): Nutrienti {
  if (!alimento || alimento.kcal === null) return { ...NUTRIENTI_ZERO }

  return perQuantita(
    {
      kcal: numero(alimento.kcal),
      proteine: numero(alimento.proteine),
      carboidrati: numero(alimento.carboidrati),
      grassi: numero(alimento.grassi),
      fibre: numero(alimento.fibre),
    },
    quantita,
  )
}

/**
 * L'obiettivo di un giorno: la somma della **prima** alternativa di ogni riga.
 *
 * Prendere la prima e non la media e' una scelta: il nutrizionista scrive per
 * prima quella che considera lo standard, e le alternative sono in genere
 * equivalenti. Su una lista composta a mano l'ordine lo decidi tu.
 */
export function obiettivoDa(righe: Riga[]): Nutrienti {
  const prime = righe
    .map((r) => r.voci[0])
    .filter((v): v is NonNullable<typeof v> => v !== undefined)

  return sommaNutrienti(prime.map((v) => nutrientiDi(v.alimento, numero(v.quantita))))
}

export function arrotonda(n: Nutrienti): { kcal: number; proteine: number; carboidrati: number; grassi: number } {
  return {
    kcal: Math.round(n.kcal),
    proteine: Math.round(n.proteine),
    carboidrati: Math.round(n.carboidrati),
    grassi: Math.round(n.grassi),
  }
}

export { sommaNutrienti, type Nutrienti }
