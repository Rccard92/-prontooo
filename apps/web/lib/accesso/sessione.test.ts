import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { impastaPassword, passwordGiusta } from './sessione'

describe('le password', () => {
  it('si verificano dopo essere state impastate', () => {
    assert.equal(passwordGiusta('cavallo a pile', impastaPassword('cavallo a pile')), true)
  })

  it('non passano se sbagliate', () => {
    assert.equal(passwordGiusta('cavallo a pila', impastaPassword('cavallo a pile')), false)
  })

  it('danno un impasto diverso ogni volta, perche il sale cambia', () => {
    assert.notEqual(impastaPassword('stessa password'), impastaPassword('stessa password'))
  })

  it('reggono gli accenti scritti in due modi diversi', () => {
    // "è" composta e "è" decomposta sono la stessa lettera per chi digita.
    assert.equal(passwordGiusta('perchè no!!', impastaPassword('perchè no!!')), true)
  })

  it('non accettano un impasto malformato', () => {
    assert.equal(passwordGiusta('qualsiasi', 'non-un-impasto'), false)
    assert.equal(passwordGiusta('qualsiasi', ''), false)
    assert.equal(passwordGiusta('qualsiasi', 'bcrypt$sale$hash'), false)
  })
})
