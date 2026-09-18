'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { alimenti, db, liste, listaVoci } from '@prontooo/db'

import { anteprimaDaPdf, salvaLista, type VoceDaSalvare } from '@/lib/lista/importa'

/** Il PDF non si salva: si legge, si mostra, e il file resta nel browser. */
export async function leggiPdf(dati: FormData) {
  const file = dati.get('pdf')

  if (!(file instanceof File) || file.size === 0) {
    redirect('/ingredienti?errore=' + encodeURIComponent('Scegli un file PDF.'))
  }

  if (file.size > 12 * 1024 * 1024) {
    redirect('/ingredienti?errore=' + encodeURIComponent('Il PDF è troppo grande, massimo 12 MB.'))
  }

  let anteprima

  try {
    anteprima = await anteprimaDaPdf(await file.arrayBuffer())
  } catch (errore) {
    console.error('lettura del PDF fallita:', errore)
    redirect(
      '/ingredienti?errore=' +
        encodeURIComponent('Non sono riuscito a leggere questo PDF. Se è una scansione, il testo non c’è.'),
    )
  }

  if (anteprima.voci.length === 0) {
    redirect(
      '/ingredienti?errore=' +
        encodeURIComponent('Nel PDF non ho trovato righe di alimenti con le quantità.'),
    )
  }

  const nome = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Dieta importata'

  await salvaLista(
    nome,
    'pdf',
    anteprima.voci.map((v) => ({
      fascia: v.fascia,
      riga: v.riga,
      ordine: v.ordine,
      testo: v.testo,
      quantita: v.quantita,
      unita: v.unita,
      alimentoId: v.alimentoId,
    })),
  )

  revalidatePath('/ingredienti')
  redirect(
    '/ingredienti?importate=' +
      anteprima.voci.length +
      '&dacollegare=' +
      anteprima.voci.filter((v) => v.alimentoId === null).length,
  )
}

export async function cambiaQuantita(dati: FormData) {
  const id = Number(dati.get('voce'))
  const quantita = Number(String(dati.get('quantita')).replace(',', '.'))

  if (Number.isInteger(id) && Number.isFinite(quantita) && quantita >= 0) {
    await db()
      .update(listaVoci)
      .set({ quantita: String(quantita) })
      .where(eq(listaVoci.id, id))
  }

  revalidatePath('/ingredienti')
}

export async function togliVoce(dati: FormData) {
  const id = Number(dati.get('voce'))

  if (Number.isInteger(id)) await db().delete(listaVoci).where(eq(listaVoci.id, id))

  revalidatePath('/ingredienti')
}

export async function collegaAlimento(dati: FormData) {
  const id = Number(dati.get('voce'))
  const alimentoId = Number(dati.get('alimento'))

  if (Number.isInteger(id) && Number.isInteger(alimentoId)) {
    await db()
      .update(listaVoci)
      .set({ alimentoId, testoGrezzo: null })
      .where(eq(listaVoci.id, id))
  }

  revalidatePath('/ingredienti')
}

/** Aggiunge un'alternativa. Senza riga si apre una riga nuova in fondo. */
export async function aggiungiVoce(dati: FormData) {
  const listaId = Number(dati.get('lista'))
  const alimentoId = Number(dati.get('alimento'))
  const fascia = String(dati.get('fascia') ?? '')
  const rigaGrezza = dati.get('riga')

  if (!Number.isInteger(listaId) || !Number.isInteger(alimentoId) || !fascia) {
    revalidatePath('/ingredienti')
    return
  }

  const [alimento] = await db()
    .select()
    .from(alimenti)
    .where(eq(alimenti.id, alimentoId))
    .limit(1)

  if (!alimento) return

  let riga = Number(rigaGrezza)

  if (!Number.isInteger(riga)) {
    const [massima] = await db()
      .select({ n: sql<number>`coalesce(max(${listaVoci.riga}), -1)` })
      .from(listaVoci)
      .where(and(eq(listaVoci.listaId, listaId), eq(listaVoci.fascia, fascia)))

    riga = (massima?.n ?? -1) + 1
  }

  const [ultimo] = await db()
    .select({ n: sql<number>`coalesce(max(${listaVoci.ordine}), -1)` })
    .from(listaVoci)
    .where(
      and(
        eq(listaVoci.listaId, listaId),
        eq(listaVoci.fascia, fascia),
        eq(listaVoci.riga, riga),
      ),
    )

  await db().insert(listaVoci).values({
    listaId,
    giorno: 'standard',
    fascia,
    riga,
    ordine: (ultimo?.n ?? -1) + 1,
    alimentoId,
    quantita: String(alimento.quantita),
    unita: alimento.unita,
  })

  revalidatePath('/ingredienti')
}

export async function rendiAttiva(dati: FormData) {
  const id = Number(dati.get('lista'))

  if (Number.isInteger(id)) {
    const connessione = db()
    await connessione.update(liste).set({ attiva: false })
    await connessione.update(liste).set({ attiva: true }).where(eq(liste.id, id))
  }

  revalidatePath('/ingredienti')
  revalidatePath('/')
}

export async function eliminaLista(dati: FormData) {
  const id = Number(dati.get('lista'))

  if (Number.isInteger(id)) await db().delete(liste).where(eq(liste.id, id))

  revalidatePath('/ingredienti')
}

/** Crea una lista vuota da riempire a mano: la strada senza nutrizionista. */
export async function listaVuota() {
  const id = await salvaLista('La mia lista', 'manuale', [] as VoceDaSalvare[])

  revalidatePath('/ingredienti')
  redirect(`/ingredienti?nuova=${id}`)
}
