'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db, offerte, volantini } from '@prontooo/db'

import { importaVolantino } from '@/lib/offerte/archivio'

function testoONull(dati: FormData, campo: string): string | null {
  const valore = String(dati.get(campo) ?? '').trim()

  return valore.length > 0 ? valore : null
}

export async function caricaVolantino(dati: FormData) {
  const file = dati.get('volantino')

  if (!(file instanceof File) || file.size === 0) return

  await importaVolantino(await file.arrayBuffer(), {
    insegna: String(dati.get('insegna') ?? 'Altro').trim() || 'Altro',
    puntoVendita: testoONull(dati, 'puntoVendita'),
    validoDal: testoONull(dati, 'validoDal'),
    validoAl: testoONull(dati, 'validoAl'),
    nomeFile: file.name,
  })

  revalidatePath('/offerte')
  revalidatePath('/spesa')
}

/** "Sì, è proprio quello": da qui in poi l'offerta è certa. */
export async function confermaAggancio(dati: FormData) {
  const id = Number(dati.get('offerta'))

  if (!Number.isInteger(id)) return

  await db().update(offerte).set({ confermato: true }).where(eq(offerte.id, id))

  revalidatePath('/offerte')
  revalidatePath('/spesa')
}

/** "No, non c'entra": l'aggancio si toglie e l'offerta resta senza alimento. */
export async function scollegaOfferta(dati: FormData) {
  const id = Number(dati.get('offerta'))

  if (!Number.isInteger(id)) return

  await db()
    .update(offerte)
    .set({ alimentoId: null, confidenza: '0', confermato: false })
    .where(eq(offerte.id, id))

  revalidatePath('/offerte')
  revalidatePath('/spesa')
}

export async function cancellaVolantino(dati: FormData) {
  const id = Number(dati.get('volantino'))

  if (!Number.isInteger(id)) return

  await db().delete(volantini).where(eq(volantini.id, id))

  revalidatePath('/offerte')
  revalidatePath('/spesa')
}
