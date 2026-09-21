'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { alimenti, db, giornataPasti, giornate } from '@prontooo/db'

import {
  generaGiornata,
  kcalDi,
  leggiGiornata,
  oggi,
} from '@/lib/giornata/componi'
import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { eData, settimanaDi } from '@/lib/giornata/settimana'
import { type Componente, type Consumato, type TipoGiorno, nutrientiConsumati } from '@/lib/giornata/modello'
import { PIATTI_FUORI } from '@/lib/giornata/piatti'
import { ricalibra } from '@/lib/giornata/ricalibra'
import { nutrientiDi } from '@/lib/lista/modello'
import { ricettaDelPasto, ricettaSuccessiva } from '@/lib/ricettario/scelta'
import { numeroDiRicetta, pastiDalleRicette, scalaRicetta } from '@/lib/giornata/daRicetta'
import { dosiRagionevoli } from '@/lib/giornata/dosi'
import { leggiProfilo } from '@/lib/profilo/leggi'
import { attive, senzaLeEscluse } from '@/lib/nutrizione/attenuazioni'

/**
 * Legge un pasto **solo se e' di questo utente**.
 *
 * L'id arriva da un campo nascosto di un form, e un id non e' una prova di
 * proprieta': senza questo controllo bastava cambiare un numero per spuntare
 * la cena di un altro.
 */
async function pastoDi(utenteId: number, pastoId: number) {
  const [riga] = await db()
    .select({ pasto: giornataPasti })
    .from(giornataPasti)
    .innerJoin(giornate, eq(giornate.id, giornataPasti.giornataId))
    .where(and(eq(giornataPasti.id, pastoId), eq(giornate.utenteId, utenteId)))
    .limit(1)

  return riga?.pasto ?? null
}

/**
 * Il giorno su cui agire, preso dal form.
 *
 * Arriva da un campo nascosto, quindi da chiunque: una data che non esiste
 * viene buttata e si torna a oggi. E non si compone niente **prima** di oggi -
 * un menu per martedi' scorso non vuol dire niente, e il pulsante nella
 * schermata infatti non c'e': questo e' il controllo che regge quando il form
 * arriva lo stesso.
 */
function giornoDaComporre(dati: FormData): string {
  const chiesto = dati.get('data')

  return eData(chiesto) && chiesto >= oggi() ? chiesto : oggi()
}

export async function generaGiorno(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const tipo = String(dati.get('tipo') ?? '') as TipoGiorno

  await generaGiornata(
    utenteId,
    giornoDaComporre(dati),
    ['standard', 'on', 'off'].includes(tipo) ? tipo : undefined,
  )
  revalidatePath('/')
}

/**
 * Prepara in un colpo i giorni della settimana che non ci sono ancora.
 *
 * Tre regole, e sono tutte e tre per non fare danni.
 *
 * **Solo da oggi in avanti.** Comporre un menu per martedi' scorso non vuol
 * dire niente, e riscriverebbe uno storico che e' gia' successo.
 *
 * **Solo i giorni vuoti.** Un giorno che hai gia' preparato - magari
 * sistemato a mano, cambiando due ricette - non si tocca. Per rifarlo c'e'
 * "rifai la giornata", che sta su quel giorno e riguarda solo lui.
 *
 * **Le ricette non si ripetono.** Ogni giorno dice quali ha usato e il giorno
 * dopo le evita: senza, cinque giorni pescati a caso dallo stesso catalogo
 * danno il salmone in crosta due volte, ed e' la prima cosa che si nota.
 */
export async function preparaSettimana(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const chiesto = dati.get('data')
  const dentro = eData(chiesto) ? chiesto : oggi()

  const gia = new Set<string>(
    (
      await db()
        .select({ data: giornate.data })
        .from(giornate)
        .where(eq(giornate.utenteId, utenteId))
    ).map((r) => r.data),
  )

  const evita: number[] = []

  for (const giorno of settimanaDi(dentro)) {
    if (giorno < oggi() || gia.has(giorno)) continue

    const fatto = await generaGiornata(utenteId, giorno, undefined, evita)

    if (fatto) evita.push(...fatto.ricetteUsate)
  }

  revalidatePath('/')
}

export async function cambiaTipoGiorno(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const tipo = String(dati.get('tipo') ?? '') as TipoGiorno

  if (!['standard', 'on', 'off'].includes(tipo)) return

  await generaGiornata(utenteId, giornoDaComporre(dati), tipo)
  revalidatePath('/')
}

/** Cambia il pasto: ripesca le alternative restando nella stessa fascia. */
export async function cambiaPasto(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  const giorno = await leggiGiornata(utenteId)
  const pasto = giorno?.pasti.find((p) => p.id === id)

  if (!giorno || !pasto) return

  await generaGiornata(utenteId, giorno.giornata.data, giorno.giornata.tipoGiorno as TipoGiorno)
  revalidatePath('/')
}

/**
 * Passa alla ricetta dopo, senza toccare i componenti.
 *
 * Cambiare ricetta non deve cambiare quello che mangi: i grammi restano
 * quelli, cambia solo come li cucini.
 */
export async function cambiaRicetta(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  const pasto = await pastoDi(utenteId, id)

  if (!pasto) return

  // Quando il pasto **e'** una ricetta del catalogo, "altra ricetta" vuol dire
  // un altro piatto, non un altro vestito sugli stessi grammi: i grammi sono
  // gli ingredienti di questa ricetta, e senza di lei non vogliono dire
  // niente. Si pesca un'altra ricetta e la si scala sulle stesse kcal, cosi'
  // la giornata continua a tornare.
  if (numeroDiRicetta(pasto.ricettaLibro) !== null) {
    await cambiaTuttoIlPiatto(utenteId, pasto)
    revalidatePath('/')

    return
  }

  const prossima = await ricettaSuccessiva(pasto.fascia, pasto.previsti, pasto.ricettaLibro)

  if (!prossima) return

  await db()
    .update(giornataPasti)
    .set({ ricettaLibro: prossima })
    .where(eq(giornataPasti.id, id))

  revalidatePath('/')
  revalidatePath(`/cucina/${id}`)
}

/**
 * Cambia un solo componente del pasto con un equivalente.
 *
 * "Non ho il pollo, ho il merluzzo": cambia quell'ingrediente e basta, con la
 * quantita' che regge lo stesso nutriente. Il resto del pasto non si tocca -
 * rigenerare tutto per un ingrediente sarebbe rifare il lavoro da capo.
 */
export async function sostituisciComponente(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('pasto'))
  const indice = Number(dati.get('indice'))
  const alimentoId = Number(dati.get('alimento'))
  const quantita = Number(dati.get('quantita'))

  if (!Number.isInteger(id) || !Number.isInteger(indice)) return
  if (!Number.isInteger(alimentoId) || !Number.isFinite(quantita) || quantita <= 0) return

  const pasto = await pastoDi(utenteId, id)

  if (!pasto || pasto.stato !== 'previsto') return

  const vecchio = pasto.previsti[indice]

  if (!vecchio) return

  const [nuovo] = await db().select().from(alimenti).where(eq(alimenti.id, alimentoId)).limit(1)

  if (!nuovo) return

  const previsti = pasto.previsti.map((c, i) =>
    i === indice
      ? {
          ...c,
          alimentoId: nuovo.id,
          nome: nuovo.nome,
          quantita: Math.round(quantita),
          unita: nuovo.unita,
        }
      : c,
  )

  // I componenti sono cambiati, quindi la ricetta scelta prima puo' non
  // calzare piu': si rifa' la scelta invece di tenersene una sbagliata.
  const ricetta = await ricettaDelPasto(pasto.fascia, previsti, null)

  await db()
    .update(giornataPasti)
    .set({ previsti, ricettaLibro: ricetta?.id ?? null })
    .where(eq(giornataPasti.id, id))

  revalidatePath('/')
  revalidatePath(`/cucina/${id}`)
}

/** Ho mangiato quello che c'era scritto. */
export async function spuntaPasto(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id)) return

  const pasto = await pastoDi(utenteId, id)

  if (!pasto) return

  const consumati = await consumatiDaComponenti(pasto.previsti)

  await db()
    .update(giornataPasti)
    .set({ stato: 'mangiato', consumati, registratoIl: new Date() })
    .where(eq(giornataPasti.id, id))

  await applicaRicalibrazione(utenteId)
  revalidatePath('/')
}

export async function saltaPasto(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id) || !(await pastoDi(utenteId, id))) return

  await db()
    .update(giornataPasti)
    .set({ stato: 'saltato', consumati: [], registratoIl: new Date() })
    .where(eq(giornataPasti.id, id))

  await applicaRicalibrazione(utenteId)
  revalidatePath('/')
}

/** Ero fuori: scelgo un piatto dall'elenco e l'app stima cosa ho mangiato. */
export async function registraFuori(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('pasto'))
  const piatto = String(dati.get('piatto') ?? '')
  const quante = Number(dati.get('porzioni') ?? 1) || 1

  if (!Number.isInteger(id) || !(await pastoDi(utenteId, id))) return

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

  await applicaRicalibrazione(utenteId)
  revalidatePath('/')
}

export async function annullaRegistrazione(dati: FormData) {
  const utenteId = await utenteObbligatorio()
  const id = Number(dati.get('pasto'))

  if (!Number.isInteger(id) || !(await pastoDi(utenteId, id))) return

  await db()
    .update(giornataPasti)
    .set({ stato: 'previsto', consumati: [], registratoIl: null })
    .where(eq(giornataPasti.id, id))

  await applicaRicalibrazione(utenteId)
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
async function applicaRicalibrazione(utenteId: number): Promise<void> {
  const giorno = await leggiGiornata(utenteId)

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

/**
 * Sostituisce il piatto intero, tenendo le calorie che aveva.
 *
 * Serve quando il pasto viene da una ricetta del catalogo. Le kcal di adesso
 * sono il bersaglio: la ricetta nuova arriva coi suoi grammi e si scala su
 * quel numero, cosi' cambi piatto senza cambiare giornata.
 */
async function cambiaTuttoIlPiatto(
  utenteId: number,
  pasto: { id: number; fascia: string; previsti: Componente[]; ricettaLibro: string | null },
) {
  const profilo = await leggiProfilo(utenteId)
  const esclusioni = profilo?.esclusioni ?? []
  const attenuazioni = senzaLeEscluse(profilo?.attenuazioni ?? [], esclusioni)

  const bersaglio = await kcalDi(pasto.previsti)
  const evitare = numeroDiRicetta(pasto.ricettaLibro)

  const trovate = await pastiDalleRicette(
    [pasto.fascia],
    esclusioni,
    attive(attenuazioni, 'sostituisci').includes('lattosio') || esclusioni.includes('lattosio'),
    evitare === null ? [] : [evitare],
  )

  const nuova = trovate.pasti.get(pasto.fascia)

  if (!nuova) return

  const fattore = bersaglio > 0 && nuova.nutrienti.kcal > 0 ? bersaglio / nuova.nutrienti.kcal : 1

  await db()
    .update(giornataPasti)
    .set({
      previsti: dosiRagionevoli(scalaRicetta(nuova.componenti, fattore), trovate.alimenti),
      ricettaLibro: nuova.ricetta,
    })
    .where(eq(giornataPasti.id, pasto.id))
}
