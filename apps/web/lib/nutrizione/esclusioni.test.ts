import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ammesso, ammessi } from './esclusioni'

const PASTA = { nome: 'Pasta di semola', etichette: ['glutine'] }
const MERLUZZO = { nome: 'Merluzzo', etichette: ['proteico', 'pesce'] }
const RISO = { nome: 'Riso', etichette: [] }

describe('ammesso', () => {
  it('tiene fuori chi porta un etichetta esclusa', () => {
    assert.equal(ammesso(PASTA, ['glutine']), false)
    assert.equal(ammesso(MERLUZZO, ['pesce']), false)
  })

  it('lascia passare chi non la porta', () => {
    assert.equal(ammesso(RISO, ['glutine', 'pesce']), true)
    assert.equal(ammesso(PASTA, ['pesce']), true)
  })

  it('basta una sola etichetta esclusa su tante', () => {
    assert.equal(ammesso(MERLUZZO, ['lattosio', 'uova', 'pesce']), false)
  })

  it('senza esclusioni passa tutto', () => {
    assert.equal(ammesso(PASTA, []), true)
  })

  it('quello che non conosciamo passa: non si esclude per ignoranza', () => {
    assert.equal(ammesso(null, ['glutine']), true)
    assert.equal(ammesso(undefined, ['glutine']), true)
  })
})

describe('ammessi', () => {
  const tutti = [PASTA, MERLUZZO, RISO]

  it('toglie dall elenco quello che non puo entrare', () => {
    assert.deepEqual(
      ammessi(tutti, ['pesce'], (a) => a.etichette).map((a) => a.nome),
      ['Pasta di semola', 'Riso'],
    )
  })

  it('puo svuotare l elenco, e va bene cosi', () => {
    assert.deepEqual(ammessi(tutti, ['glutine', 'pesce'], (a) => a.etichette).map((a) => a.nome), [
      'Riso',
    ])
  })

  it('senza esclusioni restituisce tutto', () => {
    assert.equal(ammessi(tutti, [], (a) => a.etichette).length, 3)
  })

  it('tiene le voci di cui non sa le etichette', () => {
    const conIgnoto = [...tutti, { nome: 'Da collegare', etichette: null }]

    assert.equal(
      ammessi(conIgnoto, ['glutine'], (a) => a.etichette).some((a) => a.nome === 'Da collegare'),
      true,
    )
  })
})
