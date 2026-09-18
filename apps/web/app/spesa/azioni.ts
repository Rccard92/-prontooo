'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db, dispensa, giornate, spesaSpuntati } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { generaGiornata } from '@/lib/giornata/componi'
import { lunediDi } from '@/lib/spesa/calcola'

export async function spunta(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const alimentoId = Number(dati.get('alimento'))
  const settimana = String(dati.get('settimana') ?? lunediDi())
  const ora = dati.get('spuntato') !== 'si'

  if (!Number.isInteger(alimentoId)) return

  const connessione = db()

  const [esistente] = await connessione
    .select()
    .from(spesaSpuntati)
    .where(
      and(
        eq(spesaSpuntati.utenteId, utenteId),
        eq(spesaSpuntati.settimana, settimana),
        eq(spesaSpuntati.alimentoId, alimentoId),
      ),
    )
    .limit(1)

  if (esistente) {
    await connessione
      .update(spesaSpuntati)
      .set({ spuntato: ora })
      .where(eq(spesaSpuntati.id, esistente.id))
  } else {
    await connessione
      .insert(spesaSpuntati)
      .values({ utenteId, settimana, alimentoId, spuntato: ora })
  }

  revalidatePath('/spesa')
}

export async function aggiungiInDispensa(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const alimentoId = Number(dati.get('alimento'))
  const quantita = Number(String(dati.get('quantita')).replace(',', '.'))

  if (!Number.isInteger(alimentoId) || !Number.isFinite(quantita) || quantita < 0) return

  const connessione = db()

  if (quantita === 0) {
    await connessione
      .delete(dispensa)
      .where(and(eq(dispensa.utenteId, utenteId), eq(dispensa.alimentoId, alimentoId)))
  } else {
    await connessione
      .insert(dispensa)
      .values({ utenteId, alimentoId, quantita: String(quantita), aggiornatoIl: new Date() })
      .onConflictDoUpdate({
        target: [dispensa.utenteId, dispensa.alimentoId],
        set: { quantita: String(quantita), aggiornatoIl: new Date() },
      })
  }

  revalidatePath('/spesa')
}

/** Prepara le sette giornate della settimana, cosi' la lista ha cosa sommare. */
export async function preparaSettimana(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const settimana = String(dati.get('settimana') ?? lunediDi())
  const [a, m, g] = settimana.split('-').map(Number)

  for (let i = 0; i < 7; i += 1) {
    const data = new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, (g ?? 1) + i))
      .toISOString()
      .slice(0, 10)

    const [esistente] = await db()
      .select()
      .from(giornate)
      .where(and(eq(giornate.utenteId, utenteId), eq(giornate.data, data)))
      .limit(1)

    if (!esistente) await generaGiornata(utenteId, data)
  }

  revalidatePath('/spesa')
}
