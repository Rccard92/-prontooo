import { and, asc, eq } from 'drizzle-orm'

import { type Alimento, type ListaVoce, alimenti, db, liste, listaVoci } from '@prontooo/db'

import { type Riga, righeDi } from './modello'

export type VoceConAlimento = ListaVoce & { alimento: Alimento | null }

/** La lista attiva, o null se non ne hai ancora nessuna. */
export async function listaAttiva() {
  const [lista] = await db().select().from(liste).where(eq(liste.attiva, true)).limit(1)

  return lista ?? null
}

export async function tutteLeListe() {
  return db().select().from(liste).orderBy(asc(liste.creatoIl))
}

/** Le voci di una lista, con l'alimento agganciato quando c'e'. */
export async function vociDi(listaId: number, giorno = 'standard'): Promise<VoceConAlimento[]> {
  const righe = await db()
    .select({ voce: listaVoci, alimento: alimenti })
    .from(listaVoci)
    .leftJoin(alimenti, eq(alimenti.id, listaVoci.alimentoId))
    .where(and(eq(listaVoci.listaId, listaId), eq(listaVoci.giorno, giorno)))
    .orderBy(asc(listaVoci.fascia), asc(listaVoci.riga), asc(listaVoci.ordine))

  return righe.map((r) => ({ ...r.voce, alimento: r.alimento }))
}

/** Le voci di una fascia, raggruppate nelle loro righe di alternative. */
export function righePerFascia(voci: VoceConAlimento[], fascia: string): Riga[] {
  return righeDi(voci.filter((v) => v.fascia === fascia))
}

/** Rende attiva una lista e disattiva le altre: ce n'e' sempre una sola. */
export async function attiva(listaId: number): Promise<void> {
  const connessione = db()

  await connessione.update(liste).set({ attiva: false })
  await connessione.update(liste).set({ attiva: true }).where(eq(liste.id, listaId))
}
