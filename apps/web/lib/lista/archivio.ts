import { and, asc, eq } from 'drizzle-orm'

import { type Alimento, type ListaVoce, alimenti, db, liste, listaVoci } from '@prontooo/db'

import { type Riga, righeDi } from './modello'

/**
 * Tutto qui dentro vuole `utenteId` e non lo deduce da solo.
 *
 * E' una scelta: se una di queste funzioni leggesse la sessione per conto
 * suo, dimenticarsene in una chiamata darebbe una query senza filtro, cioe'
 * la lista di un altro. Cosi' invece e' il compilatore a fermarti.
 */
export type VoceConAlimento = ListaVoce & { alimento: Alimento | null }

/** La lista attiva di un utente, o null se non ne ha ancora nessuna. */
export async function listaAttiva(utenteId: number) {
  const [lista] = await db()
    .select()
    .from(liste)
    .where(and(eq(liste.utenteId, utenteId), eq(liste.attiva, true)))
    .limit(1)

  return lista ?? null
}

export async function tutteLeListe(utenteId: number) {
  return db().select().from(liste).where(eq(liste.utenteId, utenteId)).orderBy(asc(liste.creatoIl))
}

/**
 * Le voci di una lista, con l'alimento agganciato quando c'e'.
 *
 * Passa dalla lista per controllare il proprietario: chiedere le voci di una
 * lista che non e' tua non deve restituire niente, e non deve nemmeno dire
 * che quella lista esiste.
 */
export async function vociDi(
  utenteId: number,
  listaId: number,
  giorno = 'standard',
): Promise<VoceConAlimento[]> {
  const righe = await db()
    .select({ voce: listaVoci, alimento: alimenti })
    .from(listaVoci)
    .innerJoin(liste, eq(liste.id, listaVoci.listaId))
    .leftJoin(alimenti, eq(alimenti.id, listaVoci.alimentoId))
    .where(
      and(
        eq(listaVoci.listaId, listaId),
        eq(liste.utenteId, utenteId),
        eq(listaVoci.giorno, giorno),
      ),
    )
    .orderBy(asc(listaVoci.fascia), asc(listaVoci.riga), asc(listaVoci.ordine))

  return righe.map((r) => ({ ...r.voce, alimento: r.alimento }))
}

/** Le voci di una fascia, raggruppate nelle loro righe di alternative. */
export function righePerFascia(voci: VoceConAlimento[], fascia: string): Riga[] {
  return righeDi(voci.filter((v) => v.fascia === fascia))
}

/** Rende attiva una lista e disattiva le altre: ce n'e' sempre una sola per utente. */
export async function attiva(utenteId: number, listaId: number): Promise<void> {
  const connessione = db()

  await connessione.update(liste).set({ attiva: false }).where(eq(liste.utenteId, utenteId))
  await connessione
    .update(liste)
    .set({ attiva: true })
    .where(and(eq(liste.id, listaId), eq(liste.utenteId, utenteId)))
}

/** La lista appartiene a questo utente? Da chiamare prima di toccarla. */
export async function listaTua(utenteId: number, listaId: number): Promise<boolean> {
  const [riga] = await db()
    .select({ id: liste.id })
    .from(liste)
    .where(and(eq(liste.id, listaId), eq(liste.utenteId, utenteId)))
    .limit(1)

  return riga !== undefined
}
