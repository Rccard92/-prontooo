import { createHmac, timingSafeEqual } from 'node:crypto'

import { cookies } from 'next/headers'

/**
 * Accesso con una passphrase sola. Utente uno, non serve altro.
 *
 * Il cookie non contiene la passphrase: contiene una firma HMAC di una data di
 * scadenza. Chi lo legge non impara niente, e chi lo modifica lo invalida.
 */
const NOME_COOKIE = 'eprontooo_accesso'
const DURATA_GIORNI = 90

function segreto(): string | null {
  return process.env.APP_PASSPHRASE?.trim() || null
}

function firma(scadenza: number, passphrase: string): string {
  return createHmac('sha256', passphrase).update(String(scadenza)).digest('hex')
}

function confrontoSicuro(a: string, b: string): boolean {
  const primo = Buffer.from(a)
  const secondo = Buffer.from(b)

  // timingSafeEqual pretende la stessa lunghezza, e la lunghezza diversa e'
  // gia' di per se' una risposta: si esce prima.
  if (primo.length !== secondo.length) return false

  return timingSafeEqual(primo, secondo)
}

/**
 * Se `APP_PASSPHRASE` non c'e', l'app resta aperta.
 *
 * E' voluto: un deploy senza la variabile non deve chiudere fuori l'utente da
 * casa sua. Ma la pagina di stato lo dichiara, cosi' non passa inosservato.
 */
export function protezioneAttiva(): boolean {
  return segreto() !== null
}

export async function haAccesso(): Promise<boolean> {
  const passphrase = segreto()

  if (!passphrase) return true

  const cookie = (await cookies()).get(NOME_COOKIE)?.value

  if (!cookie) return false

  const [scadenzaGrezza, firmaRicevuta] = cookie.split('.')
  const scadenza = Number(scadenzaGrezza)

  if (!scadenzaGrezza || !firmaRicevuta || !Number.isFinite(scadenza)) return false
  if (scadenza < Date.now()) return false

  return confrontoSicuro(firma(scadenza, passphrase), firmaRicevuta)
}

export async function entra(tentativo: string): Promise<boolean> {
  const passphrase = segreto()

  if (!passphrase) return true
  if (!confrontoSicuro(tentativo.trim(), passphrase)) return false

  const scadenza = Date.now() + DURATA_GIORNI * 24 * 60 * 60 * 1000

  ;(await cookies()).set(NOME_COOKIE, `${scadenza}.${firma(scadenza, passphrase)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(scadenza),
  })

  return true
}

export async function esci(): Promise<void> {
  ;(await cookies()).delete(NOME_COOKIE)
}
