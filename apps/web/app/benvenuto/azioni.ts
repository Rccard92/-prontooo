'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db, profilo } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { type Passo, prossimo } from '@/lib/benvenuto/passi'
import { leggiCosaTogliere } from '@/lib/nutrizione/attenuazioni'
import { CONDIZIONI, chiaveRegola } from '@/lib/nutrizione/condizioni'
import { ATTIVITA, OBIETTIVI, SESSI } from '@/lib/nutrizione/fabbisogno'

function decimale(dati: FormData, campo: string): number | null {
  const grezzo = String(dati.get(campo) ?? '').replace(',', '.').trim()
  const n = Number(grezzo)

  return grezzo.length > 0 && Number.isFinite(n) ? n : null
}

function fraQuelli<T extends string>(valore: string, ammessi: readonly T[]): T | null {
  return (ammessi as readonly string[]).includes(valore) ? (valore as T) : null
}

/**
 * Salva un passo e manda al successivo.
 *
 * Ogni passo scrive subito, invece di tenere tutto in memoria fino alla fine:
 * se chiudi il telefono a meta' non ricominci da capo, e il passo dopo puo'
 * leggere quello che hai appena scelto - che e' il motivo per cui chi toglie
 * il pesce non se lo ritrova fra gli ingredienti da spuntare.
 */
async function scrivi(valori: Record<string, unknown>, passo: Passo) {
  const utenteId = await utenteObbligatorio()

  await db()
    .insert(profilo)
    .values({ id: utenteId, utenteId, ...valori, aggiornatoIl: new Date() })
    .onConflictDoUpdate({
      target: profilo.id,
      set: { ...valori, aggiornatoIl: new Date() },
    })

  revalidatePath('/benvenuto', 'layout')
  revalidatePath('/profilo')

  const dopo = prossimo(passo)

  redirect(dopo ? `/benvenuto/${dopo}` : '/ingredienti/gusti?benvenuto=1')
}

export async function salvaCorpo(dati: FormData) {
  const eta = decimale(dati, 'eta')
  const altezza = decimale(dati, 'altezza')
  const pesoKg = decimale(dati, 'peso')
  const sesso = fraQuelli(String(dati.get('sesso') ?? ''), SESSI)

  if (eta === null || altezza === null || pesoKg === null || sesso === null) {
    redirect('/benvenuto/corpo?errore=' + encodeURIComponent('Servono tutti e quattro.'))
  }

  if (eta < 14 || eta > 100 || altezza < 120 || altezza > 230 || pesoKg < 30 || pesoKg > 300) {
    redirect('/benvenuto/corpo?errore=' + encodeURIComponent('Qualcuno di questi numeri non torna.'))
  }

  await scrivi(
    { sesso, eta: Math.round(eta), altezza: Math.round(altezza), pesoKg: pesoKg.toFixed(2) },
    'corpo',
  )
}

export async function salvaMovimento(dati: FormData) {
  const attivita = fraQuelli(String(dati.get('attivita') ?? ''), ATTIVITA)
  const obiettivo = fraQuelli(String(dati.get('obiettivo') ?? ''), OBIETTIVI)

  if (!attivita || !obiettivo) {
    redirect('/benvenuto/movimento?errore=' + encodeURIComponent('Scegli tutt e due.'))
  }

  await scrivi({ attivita, obiettivo }, 'movimento')
}

export async function salvaEsclusioni(dati: FormData) {
  // Due forme nello stesso passo: una casella per quasi tutte le etichette,
  // tre risposte per glutine e lattosio, che una via di mezzo ce l'hanno.
  const scelte = leggiCosaTogliere((campo) => {
    const valore = dati.get(campo)

    return typeof valore === 'string' ? valore : null
  })

  await scrivi(scelte, 'togliere')
}

export async function salvaCondizioni(dati: FormData) {
  const condizioni = CONDIZIONI.map((c) => c.id).filter((id) => dati.get(`condizione-${id}`) === 'si')

  const regoleSpente = CONDIZIONI.filter((c) => condizioni.includes(c.id)).flatMap((c) =>
    c.regole
      .filter((r) => dati.get(`regola-${chiaveRegola(c.id, r.id)}`) !== 'si')
      .map((r) => chiaveRegola(c.id, r.id)),
  )

  await scrivi({ condizioni, regoleSpente }, 'salute')
}
