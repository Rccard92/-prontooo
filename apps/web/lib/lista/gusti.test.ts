import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { VOCABOLARIO } from '@prontooo/db/alimenti'

import { type AlimentoScelto, CATEGORIE, vociDaGusti } from './gusti'

function cibo(
  id: number,
  nome: string,
  gruppo: string,
  ruoli: string[],
  fasce: string[],
  quantita = 100,
): AlimentoScelto {
  return { id, nome, gruppo, ruoli, fasce, quantita, unita: 'g' }
}

const FETTINA = cibo(1, 'Fettina di vitello', 'carne', ['proteina'], ['pranzo', 'cena'], 150)
const BROCCOLI = cibo(2, 'Broccoli', 'verdura', ['verdura'], ['pranzo', 'cena'], 200)
const AVENA = cibo(3, "Fiocchi d'avena", 'cereale', ['cereale_colazione'], ['colazione'], 40)
const YOGURT = cibo(4, 'Yogurt greco', 'latticino', ['latticino'], ['colazione', 'merenda'], 150)
const POLLO = cibo(5, 'Petto di pollo', 'carne', ['proteina'], ['pranzo', 'cena'], 150)
const PASTA = cibo(6, 'Pasta', 'cereale', ['base'], ['pranzo'], 80)
const MELA = cibo(7, 'Mela', 'frutta', ['frutta'], ['spuntino', 'merenda'], 150)

describe('vociDaGusti', () => {
  it('non mette la fettina e i broccoli a colazione', () => {
    const voci = vociDaGusti([FETTINA, BROCCOLI, AVENA, YOGURT])
    const colazione = voci.filter((v) => v.fascia === 'colazione').map((v) => v.testo)

    assert.ok(!colazione.includes('Fettina di vitello'))
    assert.ok(!colazione.includes('Broccoli'))
    assert.deepEqual(colazione.sort(), ["Fiocchi d'avena", 'Yogurt greco'])
  })

  it('mette la fettina a pranzo e a cena, dove il vocabolario la ammette', () => {
    const voci = vociDaGusti([FETTINA])

    assert.deepEqual(
      voci.map((v) => v.fascia).sort(),
      ['cena', 'pranzo'],
    )
  })

  it('mette nella stessa riga le alternative dello stesso ruolo', () => {
    const pranzo = vociDaGusti([FETTINA, POLLO]).filter((v) => v.fascia === 'pranzo')

    assert.equal(pranzo.length, 2)
    assert.equal(pranzo[0]!.riga, pranzo[1]!.riga)
    assert.notEqual(pranzo[0]!.ordine, pranzo[1]!.ordine)
  })

  it('mette in righe diverse i ruoli diversi', () => {
    const pranzo = vociDaGusti([PASTA, POLLO, BROCCOLI]).filter((v) => v.fascia === 'pranzo')
    const righe = new Set(pranzo.map((v) => v.riga))

    assert.equal(righe.size, 3)
  })

  it('mette la base prima della proteina, e la verdura dopo', () => {
    const pranzo = vociDaGusti([BROCCOLI, POLLO, PASTA]).filter((v) => v.fascia === 'pranzo')
    const per = new Map(pranzo.map((v) => [v.testo, v.riga]))

    assert.ok(per.get('Pasta')! < per.get('Petto di pollo')!)
    assert.ok(per.get('Petto di pollo')! < per.get('Broccoli')!)
  })

  it('porta la porzione tipica di ogni alimento', () => {
    const voce = vociDaGusti([FETTINA]).find((v) => v.fascia === 'pranzo')

    assert.equal(voce?.quantita, 150)
    assert.equal(voce?.unita, 'g')
  })

  it('senza gusti non fa nessuna voce', () => {
    assert.deepEqual(vociDaGusti([]), [])
  })

  it('salta le fasce che nessun alimento scelto copre', () => {
    const voci = vociDaGusti([MELA])

    assert.deepEqual([...new Set(voci.map((v) => v.fascia))].sort(), ['merenda', 'spuntino'])
  })

  it('numera le righe da zero dentro ogni fascia', () => {
    const voci = vociDaGusti([PASTA, POLLO, BROCCOLI, AVENA, YOGURT])

    for (const fascia of new Set(voci.map((v) => v.fascia))) {
      const righe = [...new Set(voci.filter((v) => v.fascia === fascia).map((v) => v.riga))].sort()

      assert.deepEqual(righe, righe.map((_, i) => i))
    }
  })
})

describe('le categorie', () => {
  it('non ripetono un gruppo', () => {
    const gruppi = CATEGORIE.map((c) => c.gruppo)

    assert.equal(new Set(gruppi).size, gruppi.length)
  })

  it('coprono tutti i gruppi del vocabolario', () => {
    // Un gruppo dimenticato qui vuol dire alimenti che non compaiono da
    // nessuna parte nella schermata, e non te ne accorgi guardando.
    const coperti = new Set(CATEGORIE.map((c) => c.gruppo))
    const scoperti = [...new Set(VOCABOLARIO.map((a) => a.gruppo))].filter((g) => !coperti.has(g))

    assert.deepEqual(scoperti, [])
  })

  it('non inventa gruppi che nel vocabolario non esistono', () => {
    const veri = new Set<string>(VOCABOLARIO.map((a) => a.gruppo))

    assert.deepEqual(
      CATEGORIE.map((c) => c.gruppo).filter((g) => !veri.has(g)),
      [],
    )
  })
})
