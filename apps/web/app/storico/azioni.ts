'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db, pesi } from '@prontooo/db'

/** Segna un peso. Uno al giorno: il secondo sostituisce il primo. */
export async function segnaPeso(dati: FormData) {
  const kg = Number(String(dati.get('kg') ?? '').replace(',', '.'))
  const data = String(dati.get('data') ?? '').trim() || new Date().toISOString().slice(0, 10)

  if (!Number.isFinite(kg) || kg < 20 || kg > 300) return

  await db()
    .insert(pesi)
    .values({ data, kg: kg.toFixed(2) })
    .onConflictDoUpdate({ target: pesi.data, set: { kg: kg.toFixed(2) } })

  revalidatePath('/storico')
}

export async function togliPeso(dati: FormData) {
  const id = Number(dati.get('peso'))

  if (!Number.isInteger(id)) return

  await db().delete(pesi).where(eq(pesi.id, id))

  revalidatePath('/storico')
}
