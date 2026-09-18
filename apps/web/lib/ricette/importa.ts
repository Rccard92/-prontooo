import { eq } from 'drizzle-orm'

import { db, ricettaIngredienti, ricette } from '@prontooo/db'

import { classifica } from './fasce'
import { estraiRicetta } from './jsonld'

const AGENTE = 'Mozilla/5.0 (compatible; eProntoooBot/0.1; progetto personale)'
const ATTESA_MASSIMA = 12_000

export type EsitoImport =
  | { ok: true; id: number; titolo: string; giaPresente: boolean }
  | { ok: false; motivo: string }

/**
 * Indirizzi che il server non deve andare a prendere per conto di chi incolla.
 * Da dentro Railway la rete privata e' raggiungibile: senza questo filtro il
 * campo "importa" diventa un modo per far bussare il server dove non deve,
 * e il login non basta a rendere sicura una cosa del genere.
 */
function indirizzoVietato(host: string): boolean {
  const nome = host.toLowerCase()

  if (nome === 'localhost' || nome.endsWith('.localhost')) return true
  if (nome.endsWith('.internal') || nome.endsWith('.local')) return true
  if (nome === '[::1]' || nome === '::1') return true

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(nome)

  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 169 && b === 254) return true
  }

  return false
}

function urlValido(grezzo: string): URL | null {
  try {
    const url = new URL(grezzo.trim())

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (indirizzoVietato(url.hostname)) return null

    return url
  } catch {
    return null
  }
}

/**
 * Scarica una pagina, ne estrae la ricetta e la salva. Reimportare lo stesso
 * link aggiorna la ricetta che c'e' gia' invece di duplicarla: le righe
 * ingrediente vengono riscritte da zero, perche' la fonte e' l'unica verita'.
 */
export async function importaDaUrl(indirizzo: string): Promise<EsitoImport> {
  const url = urlValido(indirizzo)

  if (!url) {
    return { ok: false, motivo: 'Questo non e un indirizzo web che posso aprire.' }
  }

  let html: string

  try {
    const risposta = await fetch(url, {
      headers: { 'user-agent': AGENTE, accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(ATTESA_MASSIMA),
      redirect: 'follow',
    })

    if (!risposta.ok) {
      return { ok: false, motivo: `Il sito ha risposto ${risposta.status}. Riprova piu tardi.` }
    }

    html = await risposta.text()
  } catch (errore) {
    console.error('scaricamento pagina fallito:', url.href, errore)

    return { ok: false, motivo: 'Non sono riuscito ad aprire la pagina.' }
  }

  const estratta = estraiRicetta(html, url.href)

  if (!estratta) {
    return {
      ok: false,
      motivo: 'In questa pagina non trovo una ricetta leggibile. Prova con il link diretto alla ricetta.',
    }
  }

  const { ruolo, fasce } = classifica(estratta.categoriaFonte, estratta.fonteUrl)
  const connessione = db()

  const [salvata] = await connessione
    .insert(ricette)
    .values({
      titolo: estratta.titolo,
      fonteUrl: estratta.fonteUrl,
      fonteNome: estratta.fonteNome,
      immagineUrl: estratta.immagineUrl,
      descrizione: estratta.descrizione,
      minutiPreparazione: estratta.minutiPreparazione,
      minutiCottura: estratta.minutiCottura,
      minutiTotali: estratta.minutiTotali,
      porzioni: estratta.porzioni,
      categoriaFonte: estratta.categoriaFonte,
      ruolo,
      fasce,
      passaggi: estratta.passaggi,
    })
    .onConflictDoUpdate({
      target: ricette.fonteUrl,
      set: {
        titolo: estratta.titolo,
        immagineUrl: estratta.immagineUrl,
        descrizione: estratta.descrizione,
        minutiPreparazione: estratta.minutiPreparazione,
        minutiCottura: estratta.minutiCottura,
        minutiTotali: estratta.minutiTotali,
        porzioni: estratta.porzioni,
        categoriaFonte: estratta.categoriaFonte,
      ruolo,
      fasce,
        passaggi: estratta.passaggi,
        // Gli ingredienti cambiano: quello che l'LLM aveva capito non vale piu'.
        normalizzataIl: null,
      },
    })
    .returning({ id: ricette.id, importataIl: ricette.importataIl })

  if (!salvata) {
    return { ok: false, motivo: 'Il salvataggio non e andato a buon fine.' }
  }

  await connessione.delete(ricettaIngredienti).where(eq(ricettaIngredienti.ricettaId, salvata.id))

  await connessione.insert(ricettaIngredienti).values(
    estratta.ingredienti.map((riga, posizione) => ({
      ricettaId: salvata.id,
      posizione,
      rigaGrezza: riga,
    })),
  )

  return {
    ok: true,
    id: salvata.id,
    titolo: estratta.titolo,
    giaPresente: Date.now() - salvata.importataIl.getTime() > 5_000,
  }
}
