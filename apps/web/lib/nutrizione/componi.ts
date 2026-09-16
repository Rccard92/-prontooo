import type { Alimento } from '@prontooo/db'
import type { FasciaPasto, RuoloPasto } from '@prontooo/db/alimenti'

import { impostazione as leggiImpostazione } from './impostazioni'
import { type SchemaPasto, schemiPerFascia } from './schemi'

export type Componente = {
  ruolo: string
  alimentoId: number
  nome: string
  quantita: number
  unita: string
}

export type Preferenze = {
  esclusioni: string[]
  impostazione: string
  alimentiScelti: number[]
  porzioni: number
}

/** Un alimento e' ammesso se non porta nessuna delle etichette escluse. */
export function ammesso(alimento: Alimento, escluse: Set<string>): boolean {
  return !alimento.etichette.some((e) => escluse.has(e))
}

function mescola<T>(elenco: T[]): T[] {
  const copia = [...elenco]

  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j]!, copia[i]!]
  }

  return copia
}

/**
 * Sceglie un alimento per un ruolo.
 *
 * L'ordine di preferenza e' quello che rende utile la schermata "scegli gli
 * ingredienti": prima quelli che hai spuntato tu, poi quelli che
 * l'impostazione favorisce, poi tutti gli altri. Dentro ogni gruppo si pesca a
 * caso, altrimenti la settimana sarebbe sempre la stessa.
 */
function scegliAlimento(
  ruolo: RuoloPasto,
  fascia: FasciaPasto,
  disponibili: Alimento[],
  preferenze: Preferenze,
  giaUsati: Set<number>,
): Alimento | null {
  const scelti = new Set(preferenze.alimentiScelti)
  const favorite = new Set<string>(leggiImpostazione(preferenze.impostazione).preferisci ?? [])

  const candidati = disponibili.filter(
    (a) => a.ruoli.includes(ruolo) && a.fasce.includes(fascia) && !giaUsati.has(a.id),
  )

  if (candidati.length === 0) return null

  const gruppi = [
    candidati.filter((a) => scelti.has(a.id)),
    candidati.filter((a) => !scelti.has(a.id) && a.etichette.some((e) => favorite.has(e))),
    candidati,
  ]

  for (const gruppo of gruppi) {
    if (gruppo.length > 0) return mescola(gruppo)[0]!
  }

  return null
}

function arrotonda(valore: number): number {
  // I grammi si scrivono a multipli di 5: nessuno pesa 137 g di zucchine.
  return Math.max(5, Math.round(valore / 5) * 5)
}

/**
 * Compone un pasto: sceglie uno schema fra quelli della fascia e riempie ogni
 * posto. I posti facoltativi saltano quando non c'e' un alimento ammesso; se
 * salta un posto obbligatorio, lo schema e' scartato e si prova il successivo.
 */
export function componiPasto(
  fascia: FasciaPasto,
  disponibili: Alimento[],
  preferenze: Preferenze,
  giaUsati: Set<number> = new Set(),
): { schema: SchemaPasto; componenti: Componente[] } | null {
  const impo = leggiImpostazione(preferenze.impostazione)
  const pesiFascia = impo.pesiPerFascia?.[fascia] ?? {}

  for (const schema of mescola(schemiPerFascia(fascia))) {
    const componenti: Componente[] = []
    const usatiQui = new Set(giaUsati)
    let completo = true

    for (const posto of schema.posti) {
      const alimento = scegliAlimento(posto.ruolo, fascia, disponibili, preferenze, usatiQui)

      if (!alimento) {
        if (posto.facoltativo) continue

        completo = false
        break
      }

      usatiQui.add(alimento.id)

      const moltiplicatore =
        (posto.peso ?? 1) * (impo.pesi[posto.ruolo] ?? 1) * (pesiFascia[posto.ruolo] ?? 1)

      componenti.push({
        ruolo: posto.ruolo,
        alimentoId: alimento.id,
        nome: alimento.nome,
        // Il grasso da condimento non si moltiplica per le persone: si condisce
        // la padella, non ogni piatto.
        quantita: arrotonda(
          alimento.quantita * moltiplicatore * (posto.ruolo === 'grasso' ? 1 : preferenze.porzioni),
        ),
        unita: alimento.unita,
      })
    }

    if (completo && componenti.length > 0) return { schema, componenti }
  }

  return null
}

export const NOME_RUOLO: Record<string, string> = {
  base: 'Base',
  proteina: 'Proteina',
  verdura: 'Verdura',
  grasso: 'Condimento',
  frutta: 'Frutta',
  latticino: 'Latticino',
  cereale_colazione: 'Cereali',
  spalmabile: 'Da spalmare',
  semi: 'Semi',
  snack: 'Spuntino',
}
