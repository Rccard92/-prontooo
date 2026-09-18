import { type OffertaPerAlimento, offertePerAlimenti } from '../offerte/archivio'

import { type GruppoSpesa, listaSpesa, lunediDi } from './calcola'

/**
 * La lista della spesa con sopra le offerte, e il consiglio su dove andare.
 *
 * Le offerte non cambiano la lista: la lista viene dal piano, e il piano
 * viene dai tuoi ingredienti. Le offerte dicono solo **dove** e **quanto**.
 * Un'offerta sotto soglia si mostra come da verificare, mai come prezzo certo.
 */
export type VoceConOfferte = GruppoSpesa['voci'][number] & {
  offerte: OffertaPerAlimento[]
  migliore: OffertaPerAlimento | null
}

export type GruppoConOfferte = { reparto: string; nome: string; voci: VoceConOfferte[] }

export type Tappa = {
  insegna: string
  puntoVendita: string | null
  quante: number
  spesa: number
}

export type ConsiglioSpesa = {
  gruppi: GruppoConOfferte[]
  /** Le insegne che coprono qualcosa, da quella che copre di piu'. */
  tappe: Tappa[]
  /** Quanto risparmi davvero fermandoti anche alla seconda. */
  guadagnoSeconda: number
  /** Le cose che solo la seconda insegna ha in offerta. */
  soloNellaSeconda: number
  valeDueTappe: boolean
}

/** Il prezzo per confrontare due offerte: quello al kg, se c'e'. */
function confrontabile(offerta: OffertaPerAlimento): number {
  return offerta.prezzoUnitario ?? offerta.prezzo
}

export async function spesaConOfferte(settimana = lunediDi()): Promise<ConsiglioSpesa> {
  const gruppi = await listaSpesa(settimana)
  const ids = gruppi.flatMap((g) => g.voci.map((v) => v.alimentoId))
  const per = await offertePerAlimenti(ids)

  const conOfferte: GruppoConOfferte[] = gruppi.map((gruppo) => ({
    reparto: gruppo.reparto,
    nome: gruppo.nome,
    voci: gruppo.voci.map((voce) => {
      const trovate = per.get(voce.alimentoId) ?? []

      return { ...voce, offerte: trovate, migliore: trovate.find((o) => o.certa) ?? null }
    }),
  }))

  // Il consiglio si fa solo sulle offerte certe: mandarti in giro per un
  // prezzo che non sappiamo giusto e' peggio che non dire niente.
  const certe = conOfferte.flatMap((g) =>
    g.voci.flatMap((v) => v.offerte.filter((o) => o.certa).map((o) => ({ alimentoId: v.alimentoId, o }))),
  )

  const perInsegna = new Map<string, Map<number, OffertaPerAlimento>>()

  for (const { alimentoId, o } of certe) {
    const chiave = o.puntoVendita ? `${o.insegna} · ${o.puntoVendita}` : o.insegna
    const sue = perInsegna.get(chiave) ?? new Map<number, OffertaPerAlimento>()
    const gia = sue.get(alimentoId)

    if (!gia || confrontabile(o) < confrontabile(gia)) sue.set(alimentoId, o)

    perInsegna.set(chiave, sue)
  }

  const tappe: Tappa[] = [...perInsegna.entries()]
    .map(([chiave, voci]) => {
      const prima = [...voci.values()][0]

      return {
        insegna: prima?.insegna ?? chiave,
        puntoVendita: prima?.puntoVendita ?? null,
        quante: voci.size,
        spesa: Math.round([...voci.values()].reduce((t, o) => t + o.prezzo, 0) * 100) / 100,
      }
    })
    .sort((a, b) => b.quante - a.quante || a.spesa - b.spesa)

  const chiavi = [...perInsegna.keys()].sort(
    (a, b) => perInsegna.get(b)!.size - perInsegna.get(a)!.size,
  )

  const prima = chiavi[0] ? perInsegna.get(chiavi[0])! : new Map<number, OffertaPerAlimento>()
  const seconda = chiavi[1] ? perInsegna.get(chiavi[1])! : new Map<number, OffertaPerAlimento>()

  let guadagno = 0
  let soloNellaSeconda = 0

  for (const [alimentoId, offerta] of seconda) {
    const nella = prima.get(alimentoId)

    if (!nella) {
      soloNellaSeconda += 1
      continue
    }

    if (offerta.prezzo < nella.prezzo) guadagno += nella.prezzo - offerta.prezzo
  }

  const guadagnoSeconda = Math.round(guadagno * 100) / 100

  return {
    gruppi: conOfferte,
    tappe,
    guadagnoSeconda,
    soloNellaSeconda,
    // Due tappe costano tempo e benzina: si consigliano solo se rendono.
    valeDueTappe: guadagnoSeconda >= 3 || soloNellaSeconda >= 4,
  }
}
