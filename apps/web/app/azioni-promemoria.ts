'use server'

import { eq } from 'drizzle-orm'

import { db, iscrizioniPush } from '@prontooo/db'

/** Salva il telefono che ha detto sì. Due volte lo stesso non fa due righe. */
export async function iscriviTelefono(iscrizione: {
  endpoint: string
  p256dh: string
  auth: string
}) {
  if (!iscrizione.endpoint || !iscrizione.p256dh || !iscrizione.auth) return { ok: false }

  await db()
    .insert(iscrizioniPush)
    .values(iscrizione)
    .onConflictDoUpdate({
      target: iscrizioniPush.endpoint,
      set: { p256dh: iscrizione.p256dh, auth: iscrizione.auth },
    })

  return { ok: true }
}

export async function disiscriviTelefono(endpoint: string) {
  if (!endpoint) return { ok: false }

  await db().delete(iscrizioniPush).where(eq(iscrizioniPush.endpoint, endpoint))

  return { ok: true }
}
