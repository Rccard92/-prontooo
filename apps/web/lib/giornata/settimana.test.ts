import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { eData, lunediDi, numeroDelMese, quando, settimanaDi, sposta } from './settimana'

describe('la settimana parte di lunedi', () => {
  it('trova il lunedi da un giorno qualsiasi', () => {
    // 2026-09-20 e' una domenica: il suo lunedi' e' sei giorni prima, non il
    // giorno dopo. E' l'errore che si fa usando getUTCDay cosi' com'e'.
    assert.equal(lunediDi('2026-09-20'), '2026-09-14')
    assert.equal(lunediDi('2026-09-14'), '2026-09-14')
    assert.equal(lunediDi('2026-09-16'), '2026-09-14')
  })

  it('da sette giorni di fila', () => {
    assert.deepEqual(settimanaDi('2026-09-20'), [
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
  })

  it('scavalca il mese e l’anno senza inciampare', () => {
    assert.deepEqual(settimanaDi('2026-12-31').slice(-2), ['2027-01-02', '2027-01-03'])
    assert.equal(sposta('2026-02-28', 1), '2026-03-01')
    assert.equal(sposta('2028-02-28', 1), '2028-02-29')
  })

  it('non si sposta di un giorno quando cambia l’ora legale', () => {
    // In Italia l'ora legale finisce l'ultima domenica di ottobre. Facendo i
    // conti sull'orologio locale, quella notte dura 25 ore e un giorno
    // aggiunto puo' cadere sulla data sbagliata. In UTC il problema non c'e'.
    assert.equal(sposta('2026-10-24', 1), '2026-10-25')
    assert.equal(sposta('2026-10-25', 1), '2026-10-26')
    assert.equal(lunediDi('2026-10-25'), '2026-10-19')

    // E lo stesso quando ricomincia, l'ultima domenica di marzo.
    assert.equal(sposta('2026-03-28', 1), '2026-03-29')
    assert.equal(sposta('2026-03-29', 1), '2026-03-30')
  })
})

describe('la data che arriva dall’indirizzo', () => {
  it('prende quelle scritte bene', () => {
    assert.equal(eData('2026-09-20'), true)
    assert.equal(eData('2028-02-29'), true)
  })

  it('scarta quelle che hanno la forma giusta ma non esistono', () => {
    // Il controllo sulla sola forma le farebbe passare, e finirebbero in una
    // query. Il valore arriva dall'indirizzo, cioe' da chiunque.
    assert.equal(eData('2026-02-31'), false)
    assert.equal(eData('2026-13-01'), false)
    assert.equal(eData('2027-02-29'), false)
  })

  it('scarta tutto il resto', () => {
    for (const valore of ['oggi', '20-09-2026', '2026-9-20', '', null, undefined, 42, {}]) {
      assert.equal(eData(valore), false, `${JSON.stringify(valore)} e' passato`)
    }
  })
})

describe('prima, oggi o dopo', () => {
  it('riconosce i tre casi', () => {
    assert.equal(quando('2026-09-20', '2026-09-20'), 'oggi')
    assert.equal(quando('2026-09-19', '2026-09-20'), 'passato')
    assert.equal(quando('2026-09-21', '2026-09-20'), 'futuro')
  })

  it('confronta le date, non i numeri del mese', () => {
    // Il confronto fra stringhe funziona solo perche' il formato e' a
    // lunghezza fissa e va dal piu' grande al piu' piccolo. Con "1/9/2026"
    // direbbe che settembre viene prima di febbraio.
    assert.equal(quando('2026-01-05', '2026-09-20'), 'passato')
    assert.equal(quando('2027-01-05', '2026-09-20'), 'futuro')
  })
})

describe('il numero da scrivere nella casella', () => {
  it('e il giorno del mese, non l’indice', () => {
    assert.equal(numeroDelMese('2026-09-01'), 1)
    assert.equal(numeroDelMese('2026-09-20'), 20)
    assert.equal(numeroDelMese('2026-12-31'), 31)
  })
})
