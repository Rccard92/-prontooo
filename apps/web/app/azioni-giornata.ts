'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { alimenti, db, giornataPasti } from '@prontooo/db'

import {
  generaGiornata,
  ideaRicetta,
  kcalDi,
  leggiGiornata,
  oggi,
} from '@/lib/giornata/componi'
import { type Consumato, type TipoGiorno, nutrientiConsumati } from '@/lib/giornata/modello'
import { ricalibra } from '@/lib/giornata/ricalibra'
import { nutrientiDi } from '@/lib/lista/modello'
import { PIATTI_FUORI } from '@/lib/giornata/piatti'
import { ricettaSuccessiva } from '@/lib/ricettario/scelta'

export async function generaOggi(dati: FormData) {
  const tipo = String(dati.get('tipo') ?? '') as TipoGiorno

  await generaGiornata(oggi(), ['standard', 'on', 'off'].includes(tipo) ? tipo : undefined)
  revalidatePath('/')
}

export async function cambiaTipoGiorno(dati: FormData) {
  const tipo = String(dati.get('tipo') ?? '') as TipoGiorno

  if (!['standard', 'on', 'off'].includes(tipo)) return

  await generaGiornata(oggi(), tipo)
  revalidatePath('/')
}

/** Cambia il pasto: ripesca le alternative restando nella stessa fascia. */
export async function cambiaPasto(dati: FormData) {
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  const giorno = await leggiGiornata()
  const pasto = giorno?.pasti.find((p) => p.id === id)

  if (!giorno || !pasto) return

  await generaGiornata(giorno.giornata.data, giorno.giornata.tipoGiorno as TipoGiorno)
  revalidatePath('/')
}

/**
 * Passa alla ricetta dopo, senza toccare i componenti.
 *
 * Cambiare ricetta non deve cambiare quello che mangi: i grammi restano
 * quelli, cambia solo come li cucini.
 */
export async function cambiaRicetta(dati: FormData) {
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  const [pasto] = await db().select().from(giornataPasti).where(eq(giornataPasti.id, id)).limit(1)

  if (!pasto) return

  const prossima = await ricettaSuccessiva(pasto.fascia, pasto.previsti, pasto.ricettaLibro)

  if (!prossima) return

  await db()
    .update(giornataPasti)
    .set({ ricettaLibro: prossima })
    .where(eq(giornataPasti.id, id))

  revalidatePath('/')
  revalidatePath(`/cucina/${id}`)
}

/** Ho mangiato quello che c'era scritto. */
export async function spuntaPasto(dati: FormData) {
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  const [pasto] = await db().select().from(giornataPasti).where(eq(giornataPasti.id, id)).limit(1)

  if (!pasto) return

  const consumati = await consumatiDaComponenti(pasto.previsti)

  await db()
    .update(giornataPasti)
    .set({ stato: 'mangiato', consumati, registratoIl: new Date() })
    .where(eq(giornataPasti.id, id))

  await applicaRicalibrazione()
  revalidatePath('/')
}

export async function saltaPasto(dati: FormData) {
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  await db()
    .update(giornataPasti)
    .set({ stato: 'saltato', consumati: [], registratoIl: new Date() })
    .where(eq(giornataPasti.id, id))

  await applicaRicalibrazione()
  revalidatePath('/')
}

/** Ero fuori: scelgo un piatto dall'elenco e l'app stima cosa ho mangiato. */
export async function registraFuori(dati: FormData) {
  const id = Number(dati.get('pasto'))
  const piatto = String(dati.get('piatto') ?? '')
  const quante = Number(dati.get('porzioni') ?? 1) || 1

  if (!Number.isInteger(id)) return

  const scelto = PIATTI_FUORI.find((p) => p.nome === piatto)

  if (!scelto) return

  const consumati: Consumato[] = [
    {
      alimentoId: null,
      nome: scelto.nome,
      quantita: scelto.porzione * quante,
      unita: 'g',
      kcal: Math.round(scelto.kcal * quante),
      proteine: Math.round(scelto.proteine * quante),
      carboidrati: Math.round(scelto.carboidrati * quante),
      grassi: Math.round(scelto.grassi * quante),
    },
  ]

  await db()
    .update(giornataPasti)
    .set({ stato: 'fuori_piano', consumati, registratoIl: new Date() })
    .where(eq(giornataPasti.id, id))

  await applicaRicalibrazione()
  revalidatePath('/')
}

export async function annullaRegistrazione(dati: FormData) {
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  await db()
    .update(giornataPasti)
    .set({ stato: 'previsto', consumati: [], registratoIl: null })
    .where(eq(giornataPasti.id, id))

  await applicaRicalibrazione()
  revalidatePath('/')
}

async function consumatiDaComponenti(componenti: typeof giornataPasti.$inferSelect.previsti) {
  const ids = [...new Set(componenti.map((c) => c.alimentoId).filter((i): i is number => i !== null))]
  const righe = ids.length > 0 ? await db().select().from(alimenti).where(inArray(alimenti.id, ids)) : []
  const per = new Map(righe.map((a) => [a.id, a]))

  return componenti.map((c) => {
    const n = nutrientiDi(c.alimentoId === null ? null : (per.get(c.alimentoId) ?? null), c.quantita)

    return {
      alimentoId: c.alimentoId,
      nome: c.nome,
      quantita: c.quantita,
      unita: c.unita,
      kcal: Math.round(n.kcal),
      proteine: Math.round(n.proteine),
      carboidrati: Math.round(n.carboidrati),
      grassi: Math.round(n.grassi),
    }
  })
}

/**
 * Ricalibra i pasti che restano dopo ogni registrazione.
 *
 * Non tocca quelli gia' mangiati e non compensa sul giorno dopo: quello che
 * resta fuori dalla giornata resta fuori, e si dice.
 */
async function applicaRicalibrazione(): Promise<void> {
  const giorno = await leggiGiornata()

  if (!giorno) return

  const rimanenti = giorno.pasti.filter((p) => p.stato === 'previsto')

  if (rimanenti.length === 0) return

  const consumato = nutrientiConsumati(giorno.pasti.flatMap((p) => p.consumati))
  const residuo = giorno.giornata.obiettivo.kcal - consumato.kcal

  const conKcal = await Promise.all(
    rimanenti.map(async (p) => ({
      id: p.id,
      fascia: p.fascia,
      componenti: p.previsti,
      kcalPreviste: await kcalDi(p.previsti),
    })),
  )

  const esito = ricalibra(conKcal, residuo)

  for (const pasto of esito.pasti) {
    await db()
      .update(giornataPasti)
      .set({ previsti: pasto.componenti })
      .where(eq(giornataPasti.id, pasto.id))
  }
}

export async function aggiornaIdea(dati: FormData) {
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  const [pasto] = await db().select().from(giornataPasti).where(eq(giornataPasti.id, id)).limit(1)

  if (!pasto) return

  await db()
    .update(giornataPasti)
    .set({ ricettaId: await ideaRicetta(pasto.fascia, pasto.previsti) })
    .where(eq(giornataPasti.id, id))

  revalidatePath('/')
}
