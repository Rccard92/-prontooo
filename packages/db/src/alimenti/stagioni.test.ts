import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { STAGIONI, diStagione, meseCorrente, mesiDi } from './stagioni'
import { VOCABOLARIO } from './vocabolario'

describe('le stagioni', () => {
  it('le pesche non ci sono a gennaio e ci sono a luglio', () => {
    assert.equal(diStagione(mesiDi('Pesche'), 1), false)
    assert.equal(diStagione(mesiDi('Pesche'), 7), true)
  })

  it('le arance passano per il capodanno', () => {
    for (const mese of [11, 12, 1, 2, 3, 4]) {
      assert.equal(diStagione(mesiDi('Arance'), mese), true, `mese ${mese}`)
    }

    for (const mese of [5, 6, 7, 8, 9, 10]) {
      assert.equal(diStagione(mesiDi('Arance'), mese), false, `mese ${mese}`)
    }
  })

  it('quello che non ha stagione dichiarata c e sempre', () => {
    for (let mese = 1; mese <= 12; mese += 1) {
      assert.equal(diStagione(mesiDi('Pasta di semola'), mese), true)
      assert.equal(diStagione(mesiDi('Banana'), mese), true)
    }
  })

  it('ogni intervallo sta dentro i dodici mesi e non ripete', () => {
    for (const [nome, mesi] of Object.entries(STAGIONI)) {
      assert.ok(mesi.length > 0 && mesi.length <= 12, `${nome}: ${mesi.length} mesi`)
      assert.equal(new Set(mesi).size, mesi.length, `${nome} ripete un mese`)
      assert.ok(
        mesi.every((m) => Number.isInteger(m) && m >= 1 && m <= 12),
        `${nome} ha un mese fuori scala`,
      )
    }
  })

  it('parla solo di alimenti che esistono davvero', () => {
    const nomi = new Set(VOCABOLARIO.map((a) => a.nome))
    const fantasmi = Object.keys(STAGIONI).filter((n) => !nomi.has(n))

    // Una stagione scritta per un alimento che non c'e' non fa danni, ma vuol
    // dire che uno dei due e' stato rinominato e l'altro no.
    assert.deepEqual(fantasmi, [])
  })

  it('ogni mese dell anno ha frutta e verdura disponibili', () => {
    // Se un mese resta scoperto, il vocabolario ha un buco stagionale: a
    // quel punto il piano di quel mese non avrebbe frutta, e non per colpa
    // di chi spunta.
    for (let mese = 1; mese <= 12; mese += 1) {
      for (const gruppo of ['frutta', 'verdura'] as const) {
        const quanti = VOCABOLARIO.filter(
          (a) => a.gruppo === gruppo && diStagione(mesiDi(a.nome), mese),
        ).length

        assert.ok(quanti >= 3, `mese ${mese}, ${gruppo}: solo ${quanti}`)
      }
    }
  })

  it('il mese corrente sta fra uno e dodici', () => {
    const mese = meseCorrente()

    assert.ok(Number.isInteger(mese) && mese >= 1 && mese <= 12)
  })
})
