import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  type DatiCorpo,
  datiCompleti,
  fabbisognoDi,
  kcalPerFascia,
  metabolismoBasale,
  quotePerFasce,
} from './fabbisogno'

const ANTONIO: DatiCorpo = {
  sesso: 'uomo',
  eta: 34,
  altezza: 178,
  pesoKg: 80,
  attivita: 'moderato',
  obiettivo: 'mantenere',
}

describe('metabolismoBasale', () => {
  it('segue Mifflin-St Jeor per un uomo', () => {
    // 10*80 + 6.25*178 - 5*34 + 5 = 800 + 1112.5 - 170 + 5 = 1747.5
    assert.equal(metabolismoBasale(ANTONIO), 1748)
  })

  it('per una donna sta piu in basso, a parita di tutto il resto', () => {
    const donna = metabolismoBasale({ ...ANTONIO, sesso: 'donna' })

    assert.equal(donna, metabolismoBasale(ANTONIO) - 166)
  })

  it('scende con l eta e sale col peso', () => {
    assert.ok(metabolismoBasale({ ...ANTONIO, eta: 60 }) < metabolismoBasale(ANTONIO))
    assert.ok(metabolismoBasale({ ...ANTONIO, pesoKg: 95 }) > metabolismoBasale(ANTONIO))
  })
})

describe('fabbisognoDi', () => {
  it('moltiplica il basale per il fattore di attivita', () => {
    const f = fabbisognoDi(ANTONIO)

    assert.equal(f.giornaliero, Math.round(f.basale * 1.55))
  })

  it('chi si muove di piu mangia di piu', () => {
    const fermo = fabbisognoDi({ ...ANTONIO, attivita: 'sedentario' }).giornaliero
    const attivo = fabbisognoDi({ ...ANTONIO, attivita: 'molto_attivo' }).giornaliero

    assert.ok(attivo > fermo * 1.4, `${fermo} contro ${attivo}`)
  })

  it('dimagrire toglie, mettere massa aggiunge', () => {
    const base = fabbisognoDi(ANTONIO).giornaliero

    assert.ok(fabbisognoDi({ ...ANTONIO, obiettivo: 'dimagrire' }).giornaliero < base)
    assert.ok(fabbisognoDi({ ...ANTONIO, obiettivo: 'massa' }).giornaliero > base)
  })

  it('non scende mai sotto il metabolismo basale', () => {
    // Sedentario, in deficit, anziano e leggero: il caso che spinge in basso.
    const estremo = fabbisognoDi({
      sesso: 'donna',
      eta: 75,
      altezza: 150,
      pesoKg: 45,
      attivita: 'sedentario',
      obiettivo: 'dimagrire',
    })

    assert.ok(estremo.giornaliero >= estremo.basale)
  })

  it('chi dimagrisce prende piu proteine, non meno', () => {
    const mantiene = fabbisognoDi(ANTONIO).proteine
    const dimagrisce = fabbisognoDi({ ...ANTONIO, obiettivo: 'dimagrire' }).proteine

    assert.ok(dimagrisce > mantiene, `${mantiene} contro ${dimagrisce}`)
  })

  it('i macro tornano col totale, a meno dell arrotondamento', () => {
    const f = fabbisognoDi(ANTONIO)
    const somma = f.proteine * 4 + f.carboidrati * 4 + f.grassi * 9

    assert.ok(Math.abs(somma - f.giornaliero) <= 10, `${somma} contro ${f.giornaliero}`)
  })

  it('il giorno di allenamento alza il fabbisogno', () => {
    assert.ok(fabbisognoDi(ANTONIO, 1.12).giornaliero > fabbisognoDi(ANTONIO).giornaliero)
  })

  it('non da mai carboidrati negativi', () => {
    const stretto = fabbisognoDi({
      sesso: 'donna',
      eta: 70,
      altezza: 150,
      pesoKg: 90,
      attivita: 'sedentario',
      obiettivo: 'dimagrire',
    })

    assert.ok(stretto.carboidrati >= 0)
  })
})

describe('le quote dei pasti', () => {
  it('sommano a uno con tutte le fasce', () => {
    const quote = quotePerFasce(['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'])
    const somma = [...quote.values()].reduce((t, q) => t + q, 0)

    assert.ok(Math.abs(somma - 1) < 0.0001)
  })

  it('si ridistribuiscono su chi resta, senza perdere niente', () => {
    const quote = quotePerFasce(['colazione', 'pranzo', 'cena'])
    const somma = [...quote.values()].reduce((t, q) => t + q, 0)

    assert.ok(Math.abs(somma - 1) < 0.0001)
    assert.ok(quote.get('pranzo')! > 0.35, 'il pranzo deve pesare di piu senza gli spuntini')
  })

  it('il pranzo pesa piu della colazione', () => {
    const quote = quotePerFasce(['colazione', 'pranzo', 'cena'])

    assert.ok(quote.get('pranzo')! > quote.get('colazione')!)
  })

  it('con nessuna fascia nota non inventa niente', () => {
    assert.equal(quotePerFasce(['aperitivo']).size, 0)
  })
})

describe('kcalPerFascia', () => {
  it('divide il totale fra i pasti senza perderne per strada', () => {
    const per = kcalPerFascia(2400, ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'])
    const somma = [...per.values()].reduce((t, k) => t + k, 0)

    assert.ok(Math.abs(somma - 2400) <= 5, `${somma}`)
  })
})

describe('datiCompleti', () => {
  it('riconosce i dati buoni', () => {
    assert.equal(datiCompleti(ANTONIO), true)
  })

  it('rifiuta quelli assurdi o mancanti', () => {
    assert.equal(datiCompleti(null), false)
    assert.equal(datiCompleti({}), false)
    assert.equal(datiCompleti({ ...ANTONIO, eta: 5 }), false)
    assert.equal(datiCompleti({ ...ANTONIO, altezza: 30 }), false)
    assert.equal(datiCompleti({ ...ANTONIO, pesoKg: 700 }), false)
  })
})
