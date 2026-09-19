'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db, profilo } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { ATTIVITA, OBIETTIVI, SESSI, datiCompleti } from '@/lib/nutrizione/fabbisogno'

function numero(dati: FormData, campo: string): number | null {
  const grezzo = String(dati.get(campo) ?? '').replace(',', '.').trim()

  if (grezzo.length === 0) return null

  const n = Number(grezzo)

  return Number.isFinite(n) ? n : null
}

function fraQuelli<T extends string>(valore: string, ammessi: readonly T[]): T | null {
  return (ammessi as readonly string[]).includes(valore) ? (valore as T) : null
}

export async function salvaCorpo(dati: FormData) {
  const utenteId = await utenteObbligatorio()

  const corpo = {
    sesso: fraQuelli(String(dati.get('sesso') ?? ''), SESSI),
    eta: numero(dati, 'eta'),
    altezza: numero(dati, 'altezza'),
    pesoKg: numero(dati, 'peso'),
    attivita: fraQuelli(String(dati.get('attivita') ?? ''), ATTIVITA),
    obiettivo: fraQuelli(String(dati.get('obiettivo') ?? ''), OBIETTIVI),
  }

  if (
    !datiCompleti({
      ...corpo,
      sesso: corpo.sesso ?? undefined,
      attivita: corpo.attivita ?? undefined,
      obiettivo: corpo.obiettivo ?? undefined,
      eta: corpo.eta ?? undefined,
      altezza: corpo.altezza ?? undefined,
      pesoKg: corpo.pesoKg ?? undefined,
    })
  ) {
    redirect(
      '/corpo?errore=' +
        encodeURIComponent('Qualcosa non torna: controlla età, altezza e peso.'),
    )
  }

  const valori = {
    id: utenteId,
    utenteId,
    ...corpo,
    pesoKg: corpo.pesoKg === null ? null : corpo.pesoKg.toFixed(2),
    aggiornatoIl: new Date(),
  }

  await db()
    .insert(profilo)
    .values(valori)
    .onConflictDoUpdate({
      target: profilo.id,
      set: {
        sesso: valori.sesso,
        eta: valori.eta,
        altezza: valori.altezza,
        pesoKg: valori.pesoKg,
        attivita: valori.attivita,
        obiettivo: valori.obiettivo,
        aggiornatoIl: new Date(),
      },
    })

  revalidatePath('/corpo')
  revalidatePath('/')
  redirect('/corpo?salvato=1')
}

/** Torna alle porzioni di riferimento: i dati del corpo si cancellano. */
export async function dimenticaCorpo() {
  const utenteId = await utenteObbligatorio()

  await db()
    .insert(profilo)
    .values({ id: utenteId, utenteId, aggiornatoIl: new Date() })
    .onConflictDoUpdate({
      target: profilo.id,
      set: {
        sesso: null,
        eta: null,
        altezza: null,
        pesoKg: null,
        attivita: null,
        obiettivo: null,
        aggiornatoIl: new Date(),
      },
    })

  revalidatePath('/corpo')
  revalidatePath('/')
  redirect('/corpo')
}
