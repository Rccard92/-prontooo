'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { alimenti, db, liste, listaVoci, profilo } from '@prontooo/db'

import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { alimentiScelti, vociDaGusti } from '@/lib/lista/gusti'
import { ammessi } from '@/lib/nutrizione/esclusioni'
import { attiva, listaTua } from '@/lib/lista/archivio'
import { anteprimaDaPdf, salvaLista } from '@/lib/lista/importa'

/** Una voce si tocca solo se la sua lista e' tua. */
async function voceTua(utenteId: number, voceId: number): Promise<boolean> {
  const [riga] = await db()
    .select({ id: listaVoci.id })
    .from(listaVoci)
    .innerJoin(liste, eq(liste.id, listaVoci.listaId))
    .where(and(eq(listaVoci.id, voceId), eq(liste.utenteId, utenteId)))
    .limit(1)

  return riga !== undefined
}

/** Il PDF non si salva: si legge, si mostra, e il file resta nel browser. */
export async function leggiPdf(dati: FormData) {
  const utenteId = await utenteObbligatorio()
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
    utenteId,
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

/**
 * Salva i gusti e costruisce la lista.
 *
 * I gusti restano anche nel profilo: servono altrove - a pesare le
 * alternative, a proporre le sostituzioni - e cosi' la spunta si riapre com'era.
 */
export async function salvaGusti(dati: FormData) {
  const utenteId = await utenteObbligatorio()

  // Durante il benvenuto un errore non deve buttare fuori dal giro: si torna
  // alla stessa schermata, col passo ancora aperto.
  const dalBenvenuto = String(dati.get('poi') ?? '') === 'oggi'
  const indietro = (motivo: string) =>
    '/ingredienti/gusti?' + (dalBenvenuto ? 'benvenuto=1&' : '') + 'errore=' + encodeURIComponent(motivo)

  const ids = dati
    .getAll('alimento')
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n))

  if (ids.length === 0) {
    redirect(indietro('Spunta almeno qualcosa: da niente non esce un pasto.'))
  }

  // Il filtro c'e' anche nella schermata, ma un form si puo' rispedire a mano:
  // l'esclusione la fa rispettare il server, non la casella nascosta.
  const [impostazioni] = await db()
    .select({ esclusioni: profilo.esclusioni })
    .from(profilo)
    .where(eq(profilo.utenteId, utenteId))
    .limit(1)

  const scelti = ammessi(
    await alimentiScelti(ids),
    impostazioni?.esclusioni ?? [],
    (a) => a.etichette,
  )

  const voci = vociDaGusti(scelti)

  if (voci.length === 0) {
    redirect(indietro('Quello che hai spuntato non copre nessun pasto intero. Aggiungi qualcosa.'))
  }

  await salvaLista(utenteId, 'I miei ingredienti', 'manuale', voci)

  const valori = { id: utenteId, utenteId, alimentiScelti: ids, aggiornatoIl: new Date() }

  await db()
    .insert(profilo)
    .values(valori)
    .onConflictDoUpdate({
      target: profilo.id,
      set: { alimentiScelti: ids, aggiornatoIl: new Date() },
    })

  revalidatePath('/ingredienti')
  revalidatePath('/')

  // Chi arriva dal benvenuto ha appena finito: non lo si rimanda alle
  // impostazioni, lo si porta al piatto.
  redirect(dalBenvenuto ? '/' : '/ingredienti?salvati=' + scelti.length)
}

export async function cambiaQuantita(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('voce'))
  const quantita = Number(String(dati.get('quantita')).replace(',', '.'))

  if (Number.isInteger(id) && Number.isFinite(quantita) && quantita >= 0) {
    if (await voceTua(utenteId, id)) {
      await db()
        .update(listaVoci)
        .set({ quantita: String(quantita) })
        .where(eq(listaVoci.id, id))
    }
  }

  revalidatePath('/ingredienti')
}

export async function togliVoce(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('voce'))

  if (Number.isInteger(id) && (await voceTua(utenteId, id))) {
    await db().delete(listaVoci).where(eq(listaVoci.id, id))
  }

  revalidatePath('/ingredienti')
}

export async function collegaAlimento(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('voce'))
  const alimentoId = Number(dati.get('alimento'))

  if (Number.isInteger(id) && Number.isInteger(alimentoId) && (await voceTua(utenteId, id))) {
    await db()
      .update(listaVoci)
      .set({ alimentoId, testoGrezzo: null })
      .where(eq(listaVoci.id, id))
  }

  revalidatePath('/ingredienti')
}

/** Aggiunge un'alternativa. Senza riga si apre una riga nuova in fondo. */
export async function aggiungiVoce(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const listaId = Number(dati.get('lista'))
  const alimentoId = Number(dati.get('alimento'))
  const fascia = String(dati.get('fascia') ?? '')
  const rigaGrezza = dati.get('riga')

  if (!Number.isInteger(listaId) || !Number.isInteger(alimentoId) || !fascia) {
    revalidatePath('/ingredienti')
    return
  }

  if (!(await listaTua(utenteId, listaId))) return

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
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('lista'))

  if (Number.isInteger(id) && (await listaTua(utenteId, id))) await attiva(utenteId, id)

  revalidatePath('/ingredienti')
  revalidatePath('/')
}

export async function eliminaLista(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('lista'))

  if (Number.isInteger(id)) {
    await db().delete(liste).where(and(eq(liste.id, id), eq(liste.utenteId, utenteId)))
  }

  revalidatePath('/ingredienti')
}
