import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'

import { db, utenti } from '@prontooo/db'

/**
 * Accesso con utenti veri: ognuno entra nel suo pannello.
 *
 * La password si salva con scrypt e un sale per riga. Niente librerie: scrypt
 * sta dentro Node ed e' la funzione giusta per questo lavoro.
 *
 * Il cookie non contiene la password ne' niente di segreto: contiene l'id
 * dell'utente, una scadenza e una firma HMAC delle due cose. Chi lo legge non
 * impara nulla che non sappia gia', chi lo modifica lo invalida.
 */
const NOME_COOKIE = 'eprontooo_sessione'
const DURATA_GIORNI = 90

/**
 * Il segreto che firma le sessioni.
 *
 * Senza `SEGRETO_SESSIONE` se ne genera uno a ogni avvio: l'app resta sicura,
 * ma le sessioni non sopravvivono a un riavvio e tocca rientrare. Meglio
 * rientrare che firmare con un segreto prevedibile.
 */
let segretoDiRipiego: string | null = null

function segreto(): string {
  const dalleVariabili = process.env.SEGRETO_SESSIONE?.trim()

  if (dalleVariabili) return dalleVariabili

  if (!segretoDiRipiego) {
    segretoDiRipiego = randomBytes(32).toString('hex')
    console.warn('SEGRETO_SESSIONE non impostata: le sessioni scadono a ogni riavvio.')
  }

  return segretoDiRipiego
}

function confrontoSicuro(a: string, b: string): boolean {
  const primo = Buffer.from(a)
  const secondo = Buffer.from(b)

  // timingSafeEqual pretende la stessa lunghezza, e la lunghezza diversa e'
  // gia' di per se' una risposta: si esce prima.
  if (primo.length !== secondo.length) return false

  return timingSafeEqual(primo, secondo)
}

/** `scrypt$sale$hash`, tutto in esadecimale. */
export function impastaPassword(password: string): string {
  const sale = randomBytes(16).toString('hex')
  const hash = scryptSync(password.normalize('NFKC'), sale, 64).toString('hex')

  return `scrypt$${sale}$${hash}`
}

export function passwordGiusta(password: string, salvato: string): boolean {
  const [algoritmo, sale, hash] = salvato.split('$')

  if (algoritmo !== 'scrypt' || !sale || !hash) return false

  return confrontoSicuro(scryptSync(password.normalize('NFKC'), sale, 64).toString('hex'), hash)
}

function firma(contenuto: string): string {
  return createHmac('sha256', segreto()).update(contenuto).digest('hex')
}

async function apriSessione(utenteId: number): Promise<void> {
  const scadenza = Date.now() + DURATA_GIORNI * 24 * 60 * 60 * 1000
  const contenuto = `${utenteId}.${scadenza}`

  ;(await cookies()).set(NOME_COOKIE, `${contenuto}.${firma(contenuto)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(scadenza),
  })
}

/** L'id dell'utente di questa richiesta, o `null` se non e' entrato nessuno. */
export async function utenteCorrenteId(): Promise<number | null> {
  const cookie = (await cookies()).get(NOME_COOKIE)?.value

  if (!cookie) return null

  const [grezzoId, grezzaScadenza, firmaRicevuta] = cookie.split('.')

  if (!grezzoId || !grezzaScadenza || !firmaRicevuta) return null

  const id = Number(grezzoId)
  const scadenza = Number(grezzaScadenza)

  if (!Number.isInteger(id) || !Number.isFinite(scadenza)) return null
  if (scadenza < Date.now()) return null
  if (!confrontoSicuro(firma(`${grezzoId}.${grezzaScadenza}`), firmaRicevuta)) return null

  return id
}

export type UtenteInSessione = { id: number; nome: string; email: string }

/** L'utente di questa richiesta, letto dal database perche' puo' non esserci piu'. */
export async function utenteCorrente(): Promise<UtenteInSessione | null> {
  const id = await utenteCorrenteId()

  if (id === null) return null

  const [riga] = await db()
    .select({ id: utenti.id, nome: utenti.nome, email: utenti.email })
    .from(utenti)
    .where(eq(utenti.id, id))
    .limit(1)

  return riga ?? null
}

/**
 * L'utente di questa richiesta, o si solleva.
 *
 * Le pagine e le azioni che toccano dati personali chiamano questa: cosi' un
 * dimenticanza non diventa una query senza filtro che mostra i dati di un
 * altro.
 */
export async function utenteObbligatorio(): Promise<number> {
  const id = await utenteCorrenteId()

  if (id === null) throw new Error('serve un utente in sessione')

  return id
}

export type EsitoAccesso = { ok: true } | { ok: false; motivo: string }

function normalizzaEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function accedi(email: string, password: string): Promise<EsitoAccesso> {
  const [utente] = await db()
    .select()
    .from(utenti)
    .where(eq(utenti.email, normalizzaEmail(email)))
    .limit(1)

  // Stesso messaggio per email sbagliata e password sbagliata: dire quale
  // delle due e' sbagliata regala l'elenco di chi ha un account.
  if (!utente || !passwordGiusta(password, utente.hash)) {
    return { ok: false, motivo: 'Email o password non tornano.' }
  }

  await db().update(utenti).set({ ultimoAccesso: new Date() }).where(eq(utenti.id, utente.id))
  await apriSessione(utente.id)

  return { ok: true }
}

/** Quanti utenti ci sono. Zero vuol dire che l'app e' ancora da inaugurare. */
export async function quantiUtenti(): Promise<number> {
  const righe = await db().select({ id: utenti.id }).from(utenti).limit(1)

  return righe.length
}

/**
 * Registra un utente nuovo.
 *
 * Il primo entra senza invito - qualcuno deve pur cominciare. Dal secondo in
 * poi serve `CODICE_INVITO`: l'app sta su un indirizzo pubblico, e senza
 * questo chiunque lo indovini si crea un pannello dentro casa tua.
 */
export async function registra(
  nome: string,
  email: string,
  password: string,
  invito: string,
): Promise<EsitoAccesso> {
  const nomePulito = nome.trim()
  const emailPulita = normalizzaEmail(email)

  if (nomePulito.length < 2) return { ok: false, motivo: 'Scrivi come ti chiami.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailPulita)) {
    return { ok: false, motivo: 'Questa email non sembra un indirizzo.' }
  }
  if (password.length < 8) {
    return { ok: false, motivo: 'La password vuole almeno otto caratteri.' }
  }

  const primo = (await quantiUtenti()) === 0

  if (!primo) {
    const atteso = process.env.CODICE_INVITO?.trim()

    if (!atteso) return { ok: false, motivo: 'Le iscrizioni sono chiuse.' }
    if (!confrontoSicuro(invito.trim(), atteso)) return { ok: false, motivo: 'Codice invito sbagliato.' }
  }

  const [esistente] = await db()
    .select({ id: utenti.id })
    .from(utenti)
    .where(eq(utenti.email, emailPulita))
    .limit(1)

  if (esistente) return { ok: false, motivo: 'Questa email ha già un pannello.' }

  const [creato] = await db()
    .insert(utenti)
    .values({ nome: nomePulito, email: emailPulita, hash: impastaPassword(password) })
    .returning({ id: utenti.id })

  if (!creato) return { ok: false, motivo: 'Non sono riuscito a creare il pannello.' }

  await apriSessione(creato.id)

  return { ok: true }
}

export async function esci(): Promise<void> {
  ;(await cookies()).delete(NOME_COOKIE)
}

/** Serve il codice invito per iscriversi? No solo quando non c'e' ancora nessuno. */
export async function servelInvito(): Promise<boolean> {
  return (await quantiUtenti()) > 0
}

/**
 * L'utente di questa richiesta, **col profilo compilato**.
 *
 * Chi non ha ancora dato i dati del corpo viene rimandato al profilo. Non e'
 * burocrazia: senza quei numeri le porzioni sono generiche, e un'app che ti
 * dice "mangia 80 g di pasta" senza sapere quanto pesi sta tirando a
 * indovinare. Le pagine che compongono o mostrano un piano chiamano questa,
 * non `utenteObbligatorio`.
 */
export async function utenteConProfilo(): Promise<number> {
  const { redirect } = await import('next/navigation')
  const { profilo } = await import('@prontooo/db')
  const { eq } = await import('drizzle-orm')

  const id = await utenteObbligatorio()

  const [riga] = await db()
    .select({ eta: profilo.eta, altezza: profilo.altezza, pesoKg: profilo.pesoKg })
    .from(profilo)
    .where(eq(profilo.utenteId, id))
    .limit(1)

  if (!riga || riga.eta === null || riga.altezza === null || riga.pesoKg === null) {
    redirect('/profilo?benvenuto=1')
  }

  return id
}
