'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db, pesi } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'

/** Segna un peso. Uno al giorno: il secondo sostituisce il primo. */
export async function segnaPeso(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const kg = Number(String(dati.get('kg') ?? '').replace(',', '.'))
  const data = String(dati.get('data') ?? '').trim() || new Date().toISOString().slice(0, 10)

  if (!Number.isFinite(kg) || kg < 20 || kg > 300) return

  await db()
    .insert(pesi)
    .values({ utenteId, data, kg: kg.toFixed(2) })
    .onConflictDoUpdate({ target: [pesi.utenteId, pesi.data], set: { kg: kg.toFixed(2) } })

  revalidatePath('/storico')
}

export async function togliPeso(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('peso'))

  if (!Number.isInteger(id)) return

  await db().delete(pesi).where(and(eq(pesi.id, id), eq(pesi.utenteId, utenteId)))

  revalidatePath('/storico')
}
