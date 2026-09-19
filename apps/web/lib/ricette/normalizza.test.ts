import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type VoceVocabolario, abbinaAlVocabolario } from './normalizza'

const VOCABOLARIO: VoceVocabolario[] = [
  { id: 1, nome: 'Pasta di semola', gruppo: 'cereale', ruoli: ['base'], etichette: ['glutine'] },
  { id: 2, nome: 'Passata di pomodoro', gruppo: 'verdura', ruoli: ['verdura'], etichette: [] },
  {
    id: 3,
    nome: 'Olio extravergine di oliva',
    gruppo: 'grasso',
    ruoli: ['grasso'],
    etichette: [],
  },
]

describe('abbinare le righe lette al vocabolario', () => {
  it('traduce una riga riconosciuta, con le etichette dell’alimento', () => {
    const esito = abbinaAlVocabolario(
      ['320 g di pasta di semola'],
      [{ posizione: 0, alimento: 'Pasta di semola', grammi: 320, tipo: 'alimento' }],
      VOCABOLARIO,
    )

    assert.equal(esito[0]!.alimentoId, 1)
    assert.equal(esito[0]!.grammi, 320)
    assert.equal(esito[0]!.ruolo, 'base')
    assert.deepEqual(esito[0]!.etichette, ['glutine'])
  })

  it('non si fa impressionare dalle maiuscole', () => {
    const esito = abbinaAlVocabolario(
      ['olio'],
      [{ posizione: 0, alimento: 'olio extravergine di oliva', grammi: 10, tipo: 'alimento' }],
      VOCABOLARIO,
    )

    assert.equal(esito[0]!.alimentoId, 3)
  })

  it('un nome inventato diventa sconosciuto, non un alimento a caso', () => {
    // E' il motivo per cui il modello sceglie per nome e non per id: un id
    // inventato punterebbe a un alimento vero e nessuno se ne accorgerebbe.
    const esito = abbinaAlVocabolario(
      ['200 g di seitan'],
      [{ posizione: 0, alimento: 'Seitan affumicato', grammi: 200, tipo: 'alimento' }],
      VOCABOLARIO,
    )

    assert.equal(esito[0]!.tipo, 'sconosciuto')
    assert.equal(esito[0]!.alimentoId, null)
  })

  it('tiene "libero" separato da "sconosciuto"', () => {
    const esito = abbinaAlVocabolario(
      ['sale q.b.', 'una manciata di qualcosa'],
      [
        { posizione: 0, alimento: null, grammi: null, tipo: 'libero' },
        { posizione: 1, alimento: null, grammi: null, tipo: 'sconosciuto' },
      ],
      VOCABOLARIO,
    )

    assert.equal(esito[0]!.tipo, 'libero')
    assert.equal(esito[1]!.tipo, 'sconosciuto')
  })

  it('una riga che il modello salta resta sconosciuta', () => {
    // Saltarla e darla per libera direbbe "l’ho capita e non pesa", e
    // regalerebbe alla ricetta una garanzia sulle etichette che non ha.
    const esito = abbinaAlVocabolario(
      ['320 g di pasta di semola', '200 g di qualcosa'],
      [{ posizione: 0, alimento: 'Pasta di semola', grammi: 320, tipo: 'alimento' }],
      VOCABOLARIO,
    )

    assert.equal(esito.length, 2)
    assert.equal(esito[1]!.tipo, 'sconosciuto')
  })

  it('rende una riga per ogni riga ricevuta, nell’ordine', () => {
    const righe = ['a', 'b', 'c']
    const esito = abbinaAlVocabolario(
      righe,
      [{ posizione: 2, alimento: 'Pasta di semola', grammi: 100, tipo: 'alimento' }],
      VOCABOLARIO,
    )

    assert.equal(esito.length, 3)
    assert.equal(esito[2]!.alimentoId, 1)
    assert.equal(esito[0]!.tipo, 'sconosciuto')
  })
})
