import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type Pesi, pesoDaAbitudine, scegliPesato } from './preferenze'

const VOCI = [{ alimentoId: 1 }, { alimentoId: 2 }, { alimentoId: 3 }]

describe('pesoDaAbitudine', () => {
  it('sta a uno quando mangi una cosa quanto la media', () => {
    assert.ok(Math.abs(pesoDaAbitudine(10, 10) - 1.1) < 0.001)
  })

  it('alza chi mangi piu della media e abbassa chi mangi meno', () => {
    assert.ok(pesoDaAbitudine(30, 10) > pesoDaAbitudine(2, 10))
  })

  it('non scende mai a zero: tutto deve poter uscire ogni tanto', () => {
    assert.ok(pesoDaAbitudine(0, 50) >= 0.4)
  })

  it('non sale oltre il tetto, per quanto tu mangi sempre la stessa cosa', () => {
    assert.ok(pesoDaAbitudine(1000, 1) <= 2.5)
  })

  it('senza dati resta neutro', () => {
    assert.equal(pesoDaAbitudine(0, 0), 1)
  })
})

describe('scegliPesato', () => {
  it('con una sola voce sceglie quella', () => {
    assert.deepEqual(scegliPesato([{ alimentoId: 7 }], new Map()), { alimentoId: 7 })
  })

  it('senza voci non sceglie niente', () => {
    assert.equal(scegliPesato([], new Map()), null)
  })

  it('senza pesi si comporta come un sorteggio uniforme', () => {
    assert.equal(scegliPesato(VOCI, new Map(), () => 0.5)?.alimentoId, 2)
    assert.equal(scegliPesato(VOCI, new Map(), () => 0.01)?.alimentoId, 1)
    assert.equal(scegliPesato(VOCI, new Map(), () => 0.99)?.alimentoId, 3)
  })

  it('fa uscire piu spesso chi pesa di piu', () => {
    const pesi: Pesi = new Map([[3, 8]])
    let terzo = 0
    let seme = 0.123

    for (let i = 0; i < 1000; i += 1) {
      seme = (seme * 9301 + 49297) % 233280 / 233280
      if (scegliPesato(VOCI, pesi, () => seme)?.alimentoId === 3) terzo += 1
    }

    assert.ok(terzo > 700, `il terzo e uscito ${terzo} volte su 1000`)
  })

  it('non esclude mai del tutto chi pesa poco', () => {
    const pesi: Pesi = new Map([
      [1, 0.4],
      [2, 2.5],
      [3, 2.5],
    ])

    assert.equal(scegliPesato(VOCI, pesi, () => 0)?.alimentoId, 1)
  })

  it('tratta come neutro un alimento che non conosce', () => {
    const scelto = scegliPesato([{ alimentoId: null }, { alimentoId: 2 }], new Map([[2, 1]]), () => 0.2)

    assert.equal(scelto?.alimentoId, null)
  })
})
