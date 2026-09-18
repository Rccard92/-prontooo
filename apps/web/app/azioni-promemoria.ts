'use server'

import { eq } from 'drizzle-orm'

import { db, iscrizioniPush } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'

/** Salva il telefono che ha detto sì. Due volte lo stesso non fa due righe. */
export async function iscriviTelefono(iscrizione: {
  endpoint: string
  p256dh: string
  auth: string
}) {
  if (!iscrizione.endpoint || !iscrizione.p256dh || !iscrizione.auth) return { ok: false }

  const utenteId = await utenteObbligatorio()

  await db()
    .insert(iscrizioniPush)
    .values({ ...iscrizione, utenteId })
    .onConflictDoUpdate({
      target: iscrizioniPush.endpoint,
      // Lo stesso telefono puo' passare a un altro pannello: vince l'ultimo
      // che si e' iscritto da li'.
      set: { p256dh: iscrizione.p256dh, auth: iscrizione.auth, utenteId },
    })

  return { ok: true }
}

export async function disiscriviTelefono(endpoint: string) {
  if (!endpoint) return { ok: false }

  await db().delete(iscrizioniPush).where(eq(iscrizioniPush.endpoint, endpoint))

  return { ok: true }
}
