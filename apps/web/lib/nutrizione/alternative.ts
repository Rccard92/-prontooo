import { asc, eq } from 'drizzle-orm'

import { alimenti, db, profilo } from '@prontooo/db'

import type { Componente } from '../giornata/modello'

import { type Sostituibile, type Sostituzione, sostituzioni } from './sostituzioni'

function numero(valore: string | null): number {
  return valore === null ? 0 : Number(valore)
}

/** Il vocabolario in forma sostituibile, letto una volta per pagina. */
async function vocabolario(): Promise<Sostituibile[]> {
  const righe = await db().select().from(alimenti).orderBy(asc(alimenti.nome))

  return righe.map((a) => ({
    id: a.id,
    nome: a.nome,
    gruppo: a.gruppo,
    ruoli: a.ruoli,
    etichette: a.etichette,
    unita: a.unita,
    nutrienti: {
      kcal: numero(a.kcal),
      proteine: numero(a.proteine),
      carboidrati: numero(a.carboidrati),
      grassi: numero(a.grassi),
      fibre: numero(a.fibre),
    },
  }))
}

export type AlternativeDiPasto = Map<string, Sostituzione[]>

/** La chiave di un componente dentro un pasto: la posizione, che e' stabile. */
export function chiaveComponente(pastoId: number, indice: number): string {
  return `${pastoId}:${indice}`
}

/**
 * Le alternative per ogni componente dei pasti passati.
 *
 * Una lettura sola del vocabolario e del profilo, poi tutto in memoria: la
 * schermata di oggi ha una ventina di componenti e non deve fare venti giri
 * sul database per mostrare un menu a tendina.
 */
export async function alternativeDei(
  utenteId: number,
  pasti: { id: number; previsti: Componente[] }[],
): Promise<AlternativeDiPasto> {
  const per: AlternativeDiPasto = new Map()

  if (pasti.length === 0) return per

  const [tutti, [impostazioni]] = await Promise.all([
    vocabolario(),
    db().select().from(profilo).where(eq(profilo.utenteId, utenteId)).limit(1),
  ])

  const perId = new Map(tutti.map((a) => [a.id, a]))
  const scelti = new Set(impostazioni?.alimentiScelti ?? [])
  const esclusioni = impostazioni?.esclusioni ?? []

  for (const pasto of pasti) {
    pasto.previsti.forEach((componente, indice) => {
      if (componente.alimentoId === null || componente.quantita === 0) return

      const originale = perId.get(componente.alimentoId)

      if (!originale) return

      const trovate = sostituzioni(
        originale,
        componente.quantita,
        componente.ruolo,
        tutti,
        scelti,
        esclusioni,
      )

      if (trovate.length > 0) per.set(chiaveComponente(pasto.id, indice), trovate)
    })
  }

  return per
}
