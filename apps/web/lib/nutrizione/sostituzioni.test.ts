import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type Sostituibile, quantitaEquivalente, sostituzioni } from './sostituzioni'

function cibo(
  id: number,
  nome: string,
  gruppo: string,
  ruoli: string[],
  n: [number, number, number, number, number],
  etichette: string[] = [],
): Sostituibile {
  return {
    id,
    nome,
    gruppo,
    ruoli,
    etichette,
    unita: 'g',
    nutrienti: { kcal: n[0], proteine: n[1], carboidrati: n[2], grassi: n[3], fibre: n[4] },
  }
}

const POLLO = cibo(1, 'Petto di pollo', 'carne', ['proteina'], [110, 23, 0, 1.5, 0])
const MERLUZZO = cibo(2, 'Merluzzo', 'pesce', ['proteina'], [71, 17, 0, 0.3, 0], ['pesce'])
const RICOTTA = cibo(3, 'Ricotta', 'latticino', ['proteina'], [146, 8.8, 3.5, 11, 0], ['lattosio'])
const PASTA = cibo(4, 'Pasta di semola', 'cereale', ['base'], [353, 11, 71, 1.4, 2.7], ['glutine'])
const RISO = cibo(5, 'Riso basmati', 'cereale', ['base'], [350, 7.5, 78, 0.6, 1])
const OLIO = cibo(6, 'Olio extravergine', 'grasso', ['grasso'], [899, 0, 0, 99.9, 0])
const ZUCCHINE = cibo(7, 'Zucchine', 'verdura', ['verdura'], [11, 1.3, 1.4, 0.1, 1.2])
const SPINACI = cibo(8, 'Spinaci', 'verdura', ['verdura'], [31, 3.4, 3, 0.7, 1.9])
const MARMELLATA = cibo(9, 'Marmellata', 'dolce', ['spalmabile'], [222, 0.5, 55, 0.2, 1])

const TUTTI = [POLLO, MERLUZZO, RICOTTA, PASTA, RISO, OLIO, ZUCCHINE, SPINACI, MARMELLATA]

describe('quantitaEquivalente', () => {
  it('cambia una proteina a proteine, non a peso', () => {
    const quanto = quantitaEquivalente(POLLO, 150, MERLUZZO, 'proteina')

    // 150 g di pollo fanno 34,5 g di proteine; al merluzzo ne servono ~200 g.
    assert.equal(quanto, 205)
    assert.notEqual(quanto, 150)
  })

  it('cambia una base a carboidrati', () => {
    const quanto = quantitaEquivalente(PASTA, 80, RISO, 'base')

    assert.ok(quanto !== null && quanto < 80, 'il riso ha piu carboidrati, ne serve meno')
  })

  it('cambia la verdura a peso, perche li conta il volume', () => {
    assert.equal(quantitaEquivalente(ZUCCHINE, 200, SPINACI, 'verdura'), 200)
  })

  it('non propone sostituzioni oltre il triplo', () => {
    assert.equal(quantitaEquivalente(OLIO, 10, ZUCCHINE, 'grasso'), null)
  })

  it('non divide per zero', () => {
    assert.equal(quantitaEquivalente(OLIO, 10, MERLUZZO, 'grasso'), null)
  })

  it('arrotonda a multipli di cinque', () => {
    const quanto = quantitaEquivalente(POLLO, 150, RICOTTA, 'proteina')

    assert.ok(quanto === null || quanto % 5 === 0)
  })
})

describe('sostituzioni', () => {
  it('propone alternative dello stesso ruolo', () => {
    const esito = sostituzioni(POLLO, 150, 'proteina', TUTTI, new Set())

    assert.ok(esito.length > 0)
    assert.ok(esito.every((s) => s.id !== POLLO.id))
    assert.ok(esito.some((s) => s.nome === 'Merluzzo'))
  })

  it('non propone la marmellata al posto del pollo', () => {
    const esito = sostituzioni(POLLO, 150, 'proteina', TUTTI, new Set())

    assert.ok(!esito.some((s) => s.nome === 'Marmellata'))
  })

  it('mette prima quello che hai in lista', () => {
    const esito = sostituzioni(POLLO, 150, 'proteina', TUTTI, new Set([RICOTTA.id]))

    assert.equal(esito[0]?.nome, 'Ricotta')
    assert.equal(esito[0]?.fuoriLista, false)
  })

  it('rispetta le esclusioni, che sono rigide anche qui', () => {
    const esito = sostituzioni(POLLO, 150, 'proteina', TUTTI, new Set(), ['lattosio', 'pesce'])

    assert.ok(!esito.some((s) => s.nome === 'Ricotta'))
    assert.ok(!esito.some((s) => s.nome === 'Merluzzo'))
  })

  it('dice quanto si discosta, e sulle equivalenti e poco', () => {
    const esito = sostituzioni(POLLO, 150, 'proteina', TUTTI, new Set())

    for (const s of esito) assert.ok(s.scarto <= 15, `${s.nome} si discosta del ${s.scarto}%`)
  })

  it('calcola le calorie della quantita proposta, non di cento grammi', () => {
    const esito = sostituzioni(POLLO, 150, 'proteina', TUTTI, new Set())
    const merluzzo = esito.find((s) => s.nome === 'Merluzzo')!

    assert.equal(merluzzo.kcal, Math.round((71 * merluzzo.quantita) / 100))
  })

  it('non restituisce niente se non c e niente di equivalente', () => {
    assert.deepEqual(sostituzioni(OLIO, 10, 'grasso', [ZUCCHINE, MERLUZZO], new Set()), [])
  })
})
