import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { VOCABOLARIO } from '@prontooo/db/alimenti'

import { FASCE } from '../ricette/fasce'

import { SCHEMA, postiDi, riempiPosti } from './schema'

/** Una riga finta: il ruolo e le sue alternative, che qui sono stringhe. */
function riga(ruolo: string, ...voci: string[]) {
  return { ruolo, voci }
}

/** Pesca la prima: nei test la scelta dev'essere prevedibile. */
const prima = (voci: string[]) => voci[0] ?? null

describe('lo schema del pasto', () => {
  it('non lascia nessuna fascia senza posti', () => {
    for (const fascia of FASCE) {
      assert.ok(SCHEMA[fascia].length > 0, `${fascia} senza posti`)
    }
  })

  it('tiene i pasti corti: mai piu’ di quattro posti', () => {
    // E' il punto di tutto il file. Otto alimenti in un piatto non sono un
    // pasto, e nessuna spunta per quanto larga deve poterci arrivare.
    for (const fascia of FASCE) {
      assert.ok(
        SCHEMA[fascia].length <= 4,
        `${fascia} ha ${SCHEMA[fascia].length} posti: e' tornato l'inventario`,
      )
    }
  })

  it('nomina solo ruoli che nel vocabolario esistono davvero', () => {
    const veri = new Set<string>(VOCABOLARIO.flatMap((a) => a.ruoli))

    for (const fascia of FASCE) {
      for (const posto of SCHEMA[fascia]) {
        for (const ruolo of posto.ruoli) {
          assert.ok(veri.has(ruolo), `${fascia}/${posto.nome} chiede "${ruolo}", che non esiste`)
        }
      }
    }
  })

  it('chiede a ogni fascia solo ruoli che quella fascia puo’ dare', () => {
    // Un posto obbligatorio che nessun alimento di quella fascia puo'
    // riempire sarebbe un buco permanente: l'app direbbe per sempre "ti manca
    // la verdura a colazione".
    for (const fascia of FASCE) {
      for (const posto of SCHEMA[fascia]) {
        if (!posto.obbligatorio) continue

        const copribile = VOCABOLARIO.some(
          (a) => a.fasce.includes(fascia) && posto.ruoli.includes(a.ruoli[0] ?? ''),
        )

        assert.ok(copribile, `${fascia}: "${posto.nome}" non e' riempibile da nessun alimento`)
      }
    }
  })

  it('non ripete lo stesso ruolo in due posti della stessa fascia', () => {
    for (const fascia of FASCE) {
      const visti = new Set<string>()

      for (const posto of SCHEMA[fascia]) {
        for (const ruolo of posto.ruoli) {
          assert.ok(!visti.has(ruolo), `${fascia}: "${ruolo}" compare in due posti`)
          visti.add(ruolo)
        }
      }
    }
  })
})

describe('riempire i posti', () => {
  it('da’ un componente per posto, non uno per riga', () => {
    // Il caso dello screenshot: nove righe spuntate a colazione.
    const righe = [
      riga('cereale_colazione', 'Fiocchi'),
      riga('base', 'Pane'),
      riga('latticino', 'Yogurt'),
      riga('proteina', 'Salmone affumicato'),
      riga('frutta', 'Mango'),
      riga('spalmabile', 'Marmellata'),
      riga('semi', 'Noci'),
      riga('snack', 'Granita'),
    ]

    const scelte = riempiPosti(postiDi('colazione'), righe, prima)
      .map((p) => p.scelta)
      .filter((s) => s !== null)

    assert.equal(scelte.length, 4)
    assert.deepEqual(scelte, ['Fiocchi', 'Yogurt', 'Mango', 'Marmellata'])
  })

  it('non usa due volte la stessa riga', () => {
    const latticino = riga('latticino', 'Yogurt')
    const scelte = riempiPosti(postiDi('spuntino'), [riga('frutta', 'Mela'), latticino], prima)

    assert.deepEqual(
      scelte.map((p) => p.scelta),
      ['Mela', 'Yogurt'],
    )
  })

  it('passa al ruolo di ripiego solo quando il primo non c’e’', () => {
    const conCereale = riempiPosti(
      postiDi('colazione'),
      [riga('cereale_colazione', 'Fiocchi'), riga('base', 'Pane')],
      prima,
    )

    assert.equal(conCereale[0]!.scelta, 'Fiocchi')

    const senzaCereale = riempiPosti(postiDi('colazione'), [riga('base', 'Pane')], prima)

    assert.equal(senzaCereale[0]!.scelta, 'Pane')
  })

  it('lascia vuoto il posto che nessuna riga puo’ riempire', () => {
    const scelte = riempiPosti(postiDi('pranzo'), [riga('base', 'Pasta')], prima)

    assert.equal(scelte[0]!.scelta, 'Pasta')
    assert.equal(scelte[1]!.scelta, null)
    assert.ok(scelte[1]!.posto.obbligatorio)
  })

  it('mette insieme le righe dello stesso ruolo prima di pescare', () => {
    const viste: string[][] = []
    const spia = (voci: string[]) => {
      viste.push(voci)

      return voci[0] ?? null
    }

    riempiPosti(postiDi('pranzo'), [riga('base', 'Pasta'), riga('base', 'Riso')], spia)

    assert.deepEqual(viste[0], ['Pasta', 'Riso'])
  })
})
