import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { nocciolo } from './archivio'

describe('il nocciolo di una riga ingrediente', () => {
  it('butta quantita’ e unita’ e tiene il nome', () => {
    assert.equal(nocciolo('320 g di pasta di semola'), 'pasta semola')
    assert.equal(nocciolo('2 cucchiai di olio extravergine'), 'olio extravergine')
    assert.equal(nocciolo('Sale q.b.'), 'sale')
  })

  it('fa cadere sullo stesso nocciolo modi diversi di dire la stessa cosa', () => {
    // E' il punto: contarle separate le terrebbe tutte e due in fondo alla
    // classifica, e non si capirebbe mai che manca il vino.
    assert.equal(nocciolo('200 ml di vino bianco'), nocciolo('un bicchiere di vino bianco'))
    assert.equal(nocciolo('1 spicchio di aglio'), nocciolo('2 spicchi di aglio'))
  })

  it('toglie le parentesi, che portano note e non ingredienti', () => {
    assert.equal(nocciolo('100 g di pancetta (a cubetti)'), 'pancetta')
  })

  it('non lascia spazi in giro', () => {
    assert.equal(nocciolo('  500   g   di   pomodorini  '), 'pomodorini')
  })

  it('su una riga di sole quantita’ non resta niente', () => {
    // Chi chiama salta le righe vuote: contare "" come mancanza del
    // vocabolario sarebbe rumore in cima alla classifica.
    assert.equal(nocciolo('q.b.'), '')
  })
})
