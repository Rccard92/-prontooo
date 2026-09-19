import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { VOCABOLARIO } from '@prontooo/db/alimenti'

import { type VoceVocabolario, abbinaAlVocabolario, parole } from './normalizza'

const TRE_ALIMENTI: VoceVocabolario[] = [
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
      TRE_ALIMENTI,
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
      TRE_ALIMENTI,
    )

    assert.equal(esito[0]!.alimentoId, 3)
  })

  it('riconosce le stesse parole in un altro ordine', () => {
    // Caso vero, preso dai log: la ricetta diceva "olio di oliva
    // extravergine", il vocabolario dice "Olio extravergine di oliva", e
    // quella riga faceva cadere tutta la ricetta.
    const esito = abbinaAlVocabolario(
      ['120 gr di olio di oliva extravergine'],
      [{ posizione: 0, alimento: 'olio di oliva extravergine', grammi: 120, tipo: 'alimento' }],
      TRE_ALIMENTI,
    )

    assert.equal(esito[0]!.alimentoId, 3)
    assert.equal(esito[0]!.tipo, 'alimento')
  })

  it('non si fa ingannare dalla punteggiatura', () => {
    const esito = abbinaAlVocabolario(
      ['pasta'],
      [{ posizione: 0, alimento: 'Pasta, di semola', grammi: 80, tipo: 'alimento' }],
      TRE_ALIMENTI,
    )

    assert.equal(esito[0]!.alimentoId, 1)
  })

  it('un nome inventato diventa sconosciuto, non un alimento a caso', () => {
    // E' il motivo per cui il modello sceglie per nome e non per id: un id
    // inventato punterebbe a un alimento vero e nessuno se ne accorgerebbe.
    const esito = abbinaAlVocabolario(
      ['200 g di seitan'],
      [{ posizione: 0, alimento: 'Seitan affumicato', grammi: 200, tipo: 'alimento' }],
      TRE_ALIMENTI,
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
      TRE_ALIMENTI,
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
      TRE_ALIMENTI,
    )

    assert.equal(esito.length, 2)
    assert.equal(esito[1]!.tipo, 'sconosciuto')
  })

  it('rende una riga per ogni riga ricevuta, nell’ordine', () => {
    const righe = ['a', 'b', 'c']
    const esito = abbinaAlVocabolario(
      righe,
      [{ posizione: 2, alimento: 'Pasta di semola', grammi: 100, tipo: 'alimento' }],
      TRE_ALIMENTI,
    )

    assert.equal(esito.length, 3)
    assert.equal(esito[2]!.alimentoId, 1)
    assert.equal(esito[0]!.tipo, 'sconosciuto')
  })
})

describe('le parole di un nome', () => {
  it('cadono sulla stessa chiave in qualunque ordine', () => {
    assert.equal(parole('Olio extravergine di oliva'), parole('olio di oliva extravergine'))
  })

  it('nel vocabolario vero non fanno collidere due alimenti diversi', () => {
    // E' la condizione che rende sicuro il confronto morbido: se due voci
    // avessero le stesse parole, una riga finirebbe sull'alimento sbagliato
    // e nessuno se ne accorgerebbe.
    const viste = new Map<string, string>()

    for (const alimento of VOCABOLARIO) {
      const chiave = parole(alimento.nome)
      const gia = viste.get(chiave)

      assert.equal(gia, undefined, `"${alimento.nome}" e "${gia}" hanno le stesse parole`)
      viste.set(chiave, alimento.nome)
    }
  })
})

describe('le paroline e i numeri', () => {
  it('ignora articoli e preposizioni, che cambiano da sito a sito', () => {
    assert.equal(parole("Olio extravergine d'oliva"), parole('Olio extravergine di oliva'))
  })

  it('tiene i numeri, che invece distinguono', () => {
    // Senza questa riga "Yogurt greco 5%" e "Yogurt greco 0%" cadono sulla
    // stessa chiave e il piano ti da' l'uno per l'altro.
    assert.notEqual(parole('Yogurt greco 5%'), parole('Yogurt greco 0%'))
  })
})
