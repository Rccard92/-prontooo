import { asc, eq } from 'drizzle-orm'

import { type NuovaListaVoce, alimenti, db, liste, listaVoci } from '@prontooo/db'

import { agganciaAlimento, leggiDieta, type VocePdf } from './pdf'

export type Anteprima = {
  voci: (VocePdf & { alimentoId: number | null; alimentoNome: string | null })[]
  scartate: string[]
  giorniTrovati: number
}

/** Estrae il testo da un PDF con testo selezionabile. */
export async function testoDelPdf(dati: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const documento = await getDocumentProxy(new Uint8Array(dati))
  const { text } = await extractText(documento, { mergePages: true })

  return Array.isArray(text) ? text.join('\n') : text
}

/**
 * Legge il PDF e prepara l'anteprima da confermare.
 *
 * Non salva niente: un import che entra in silenzio con i grammi sbagliati lo
 * scopri fra tre settimane. Prima si guarda, poi si conferma.
 */
export async function anteprimaDaPdf(dati: ArrayBuffer): Promise<Anteprima> {
  const esito = leggiDieta(await testoDelPdf(dati))
  const vocabolario = await db()
    .select({ id: alimenti.id, nome: alimenti.nome })
    .from(alimenti)
    .orderBy(asc(alimenti.nome))

  const perId = new Map(vocabolario.map((a) => [a.id, a.nome]))

  return {
    ...esito,
    voci: esito.voci.map((v) => {
      const alimentoId = agganciaAlimento(v.testo, vocabolario)

      return { ...v, alimentoId, alimentoNome: alimentoId ? (perId.get(alimentoId) ?? null) : null }
    }),
  }
}

export type VoceDaSalvare = {
  fascia: string
  riga: number
  ordine: number
  testo: string
  quantita: number
  unita: string
  alimentoId: number | null
}

/** Salva una lista nuova e la rende attiva. */
export async function salvaLista(
  nome: string,
  origine: 'pdf' | 'manuale',
  voci: VoceDaSalvare[],
  giorno = 'standard',
): Promise<number> {
  const connessione = db()

  const [lista] = await connessione
    .insert(liste)
    .values({ nome, origine, attiva: true })
    .returning({ id: liste.id })

  if (!lista) throw new Error('creazione della lista fallita')

  await connessione.update(liste).set({ attiva: false })
  await connessione.update(liste).set({ attiva: true }).where(eq(liste.id, lista.id))

  if (voci.length > 0) {
    const righe: NuovaListaVoce[] = voci.map((v) => ({
      listaId: lista.id,
      giorno,
      fascia: v.fascia,
      riga: v.riga,
      ordine: v.ordine,
      alimentoId: v.alimentoId,
      testoGrezzo: v.alimentoId === null ? v.testo : null,
      quantita: String(v.quantita),
      unita: v.unita,
    }))

    await connessione.insert(listaVoci).values(righe)
  }

  return lista.id
}
