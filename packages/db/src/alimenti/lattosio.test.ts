import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { POCO_LATTOSIO, SENZA_LATTOSIO, cheFarneCol } from './lattosio'
import { VOCABOLARIO } from './vocabolario'

const PER_NOME = new Map(VOCABOLARIO.map((a) => [a.nome, a]))

describe('il lattosio attenuato', () => {
  it('sostituisce solo con gemelli che nel vocabolario esistono', () => {
    // Un gemello scritto male non farebbe niente e non si vedrebbe: il piano
    // proporrebbe un alimento che al banco non sai nemmeno cercare.
    for (const [normale, gemello] of Object.entries(SENZA_LATTOSIO)) {
      assert.ok(PER_NOME.has(normale), `"${normale}" non e' nel vocabolario`)
      assert.ok(PER_NOME.has(gemello), `"${gemello}" non e' nel vocabolario`)
    }
  })

  it('non propone un gemello che a sua volta porta lattosio', () => {
    for (const gemello of Object.values(SENZA_LATTOSIO)) {
      assert.ok(
        !(PER_NOME.get(gemello)!.etichette ?? []).includes('lattosio'),
        `"${gemello}" porta ancora l'etichetta lattosio`,
      )
    }
  })

  it('scambia dentro lo stesso gruppo e per lo stesso ruolo', () => {
    // Sostituire la mozzarella con uno yogurt riempirebbe il posto sbagliato:
    // il piatto si reggeva su quella proteina.
    for (const [normale, gemello] of Object.entries(SENZA_LATTOSIO)) {
      const primo = PER_NOME.get(normale)!
      const secondo = PER_NOME.get(gemello)!

      assert.equal(secondo.gruppo, primo.gruppo, `${normale}: gruppo diverso`)
      assert.ok(
        primo.ruoli.some((r) => secondo.ruoli.includes(r)),
        `${normale}: il gemello non copre nessuno dei suoi ruoli`,
      )
    }
  })

  it('tiene gli stagionati, che il lattosio non ce l’hanno quasi piu’', () => {
    for (const nome of POCO_LATTOSIO) {
      const alimento = PER_NOME.get(nome)

      assert.ok(alimento, `"${nome}" non e' nel vocabolario`)
      assert.equal(cheFarneCol(nome, alimento.etichette ?? []), 'tieni')
    }
  })

  it('decide bene i tre casi', () => {
    assert.equal(cheFarneCol('Mozzarella', ['lattosio']), 'sostituisci')
    assert.equal(cheFarneCol('Grana Padano', ['lattosio']), 'tieni')
    assert.equal(cheFarneCol('Burrata', ['lattosio']), 'togli')
    assert.equal(cheFarneCol('Petto di pollo', ['proteico']), 'tieni')
  })
})
