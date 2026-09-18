import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SOGLIA_CERTA, agganciaOfferta, eCerta } from './aggancia'
import { leggiRiga, leggiVolantino, spezzaRigheLunghe } from './volantino'

const ALIMENTI = [
  { id: 1, nome: 'Petto di pollo' },
  { id: 2, nome: 'Zucchine' },
  { id: 3, nome: 'Yogurt greco 0%' },
  { id: 4, nome: 'Pasta di semola' },
  { id: 5, nome: 'Olio extravergine di oliva' },
  { id: 6, nome: 'Pistacchi' },
  { id: 7, nome: 'Tonno al naturale' },
  { id: 8, nome: 'Fesa di tacchino' },
]

describe('leggiRiga', () => {
  it('legge nome e prezzo', () => {
    const o = leggiRiga('Petto di pollo AIA 500 g 4,99 €')

    assert.equal(o?.prezzo, 4.99)
    assert.match(o!.nomeGrezzo, /Petto di pollo/)
  })

  it('legge il formato', () => {
    assert.equal(leggiRiga('Zucchine 500 g 1,29')?.formato, '500 g')
    assert.equal(leggiRiga('Yogurt conf. 2 x 125 g 1,79')?.formato, '2 x 125 g')
    assert.equal(leggiRiga('Latte intero 1,5 l 1,45')?.formato, '1,5 l')
  })

  it('legge il prezzo al kg e non lo scambia per il prezzo', () => {
    const o = leggiRiga('Pistacchi sgusciati 150 g 3,99 al kg 26,60')

    assert.equal(o?.prezzo, 3.99)
    assert.equal(o?.prezzoUnitario, 26.6)
    assert.equal(o?.unitaPrezzo, 'kg')
  })

  it('riconosce il prezzo al litro', () => {
    const o = leggiRiga('Olio extravergine 1 l 6,90 € / l 6,90')

    assert.equal(o?.unitaPrezzo, 'l')
  })

  it('prende la marca solo quando non e tutto maiuscolo', () => {
    assert.equal(leggiRiga('Tonno RIO MARE 3 x 80 g 4,49')?.marca, 'RIO MARE')
    assert.equal(leggiRiga('TONNO ALL OLIO DI OLIVA 4,49')?.marca, null)
  })

  it('butta le righe senza prezzo', () => {
    assert.equal(leggiRiga('OFFERTE DELLA SETTIMANA'), null)
    assert.equal(leggiRiga('Seguici sui social'), null)
    assert.equal(leggiRiga('Petto di pollo'), null)
  })

  it('butta le righe di servizio anche se hanno un numero', () => {
    assert.equal(leggiRiga('Valido dal 12,03 al 25,03'), null)
    assert.equal(leggiRiga('pag. 4'), null)
  })

  it('butta le righe dove resta solo lo sconto', () => {
    assert.equal(leggiRiga('-30% 1,99'), null)
  })

  it('butta i prezzi da elettrodomestico', () => {
    assert.equal(leggiRiga('Lavatrice 399,00'), null)
  })
})

describe('leggiVolantino', () => {
  const VOLANTINO = `
VOLANTINO SUPER RISPARMIO
Valido dal 12/03 al 25/03

ORTOFRUTTA
Zucchine 1 kg 1,49
Pomodori ciliegino 500 g 1,99
Mele Golden
1,29

MACELLERIA
Petto di pollo AIA al kg 8,90 1,00 kg 8,90
Fesa di tacchino 400 g 4,29

Seguici su www.superrisparmio.it
pag. 3
`

  it('trova le offerte e lascia fuori il resto', () => {
    const offerte = leggiVolantino(VOLANTINO)
    const nomi = offerte.map((o) => o.nomeGrezzo.toLowerCase())

    assert.ok(nomi.some((n) => n.includes('zucchine')))
    assert.ok(nomi.some((n) => n.includes('fesa di tacchino')))
    assert.ok(!nomi.some((n) => n.includes('seguici')))
    assert.ok(!nomi.some((n) => n.includes('pag')))
  })

  it('accorpa il prezzo staccato alla riga sopra', () => {
    const offerte = leggiVolantino(VOLANTINO)
    const mele = offerte.find((o) => o.nomeGrezzo.toLowerCase().includes('mele'))

    assert.equal(mele?.prezzo, 1.29)
  })

  it('non ripete la stessa offerta due volte', () => {
    const offerte = leggiVolantino('Zucchine 500 g 1,29\nZucchine 500 g 1,29')

    assert.equal(offerte.length, 1)
  })
})

describe('spezzaRigheLunghe', () => {
  it('lascia stare le righe normali', () => {
    assert.deepEqual(spezzaRigheLunghe(['Zucchine 500 g 1,29']), ['Zucchine 500 g 1,29'])
  })

  it('taglia dopo ogni prezzo quando il PDF da una riga sola lunghissima', () => {
    const unicaRiga =
      'ORTOFRUTTA Zucchine 1 kg 1,49 Pomodori ciliegino 500 g 1,99 Mele Golden 1 kg 1,29 ' +
      'MACELLERIA Petto di pollo 1,00 kg 8,90 Fesa di tacchino 400 g 4,29 ' +
      'Merluzzo surgelato 400 g 3,99 Yogurt greco 2 x 150 g 1,79 ' +
      'Olio extravergine 1 l 6,90 Pasta di semola 500 g 0,89 Riso Carnaroli 1 kg 2,49'

    assert.ok(unicaRiga.length > 200, 'la riga di prova deve essere lunga')

    const spezzate = spezzaRigheLunghe([unicaRiga])

    assert.ok(spezzate.length >= 8, `spezzate in ${spezzate.length}`)
    assert.ok(spezzate.every((r) => r.length <= 200))
  })

  it('da quella riga unica escono le offerte vere', () => {
    const unicaRiga =
      'ORTOFRUTTA Zucchine 1 kg 1,49 Pomodori ciliegino 500 g 1,99 ' +
      'MACELLERIA Fesa di tacchino 400 g 4,29 Merluzzo surgelato 400 g 3,99 ' +
      'Yogurt greco 2 x 150 g 1,79 Olio extravergine 1 l 6,90 ' +
      'Pasta di semola 500 g 0,89 Riso Carnaroli 1 kg 2,49 Mele Golden 1 kg 1,29'

    const nomi = leggiVolantino(unicaRiga).map((o) => o.nomeGrezzo.toLowerCase())

    assert.ok(nomi.some((n) => n.includes('zucchine')), nomi.join(' | '))
    assert.ok(nomi.some((n) => n.includes('tacchino')), nomi.join(' | '))
    assert.ok(nomi.some((n) => n.includes('olio')), nomi.join(' | '))
  })

  it('non perde il testo quando dopo l ultimo prezzo resta qualcosa', () => {
    const lunga = 'x'.repeat(190) + ' Zucchine 1,49 Pomodori senza prezzo qui'
    const spezzate = spezzaRigheLunghe([lunga])

    assert.ok(spezzate.join(' ').includes('Pomodori senza prezzo qui'))
  })
})

describe('agganciaOfferta', () => {
  it('aggancia con certezza quando il nome c e tutto', () => {
    const esito = agganciaOfferta('Petto di pollo AIA 500 g', ALIMENTI)

    assert.equal(esito?.alimentoId, 1)
    assert.ok(eCerta(esito!.confidenza))
  })

  it('regge marca e formato in mezzo', () => {
    const esito = agganciaOfferta('YOGURT GRECO 0% FAGE vaschetta 150 g', ALIMENTI)

    assert.equal(esito?.alimentoId, 3)
    assert.ok(esito!.confidenza >= SOGLIA_CERTA)
  })

  it('non scambia il gelato al pistacchio per i pistacchi', () => {
    const esito = agganciaOfferta('Gelato al pistacchio vaschetta 500 ml', ALIMENTI)

    assert.ok(esito === null || !eCerta(esito.confidenza))
  })

  it('non aggancia quello che non c e nel vocabolario', () => {
    assert.equal(agganciaOfferta('Detersivo lavatrice 30 lavaggi', ALIMENTI), null)
  })

  it('lascia da verificare un aggancio a una parola sola', () => {
    const esito = agganciaOfferta('Filetti di pollo impanati', ALIMENTI)

    assert.ok(esito === null || !eCerta(esito.confidenza))
  })

  it('un aggancio confermato a mano e certo comunque', () => {
    assert.equal(eCerta(0.2, true), true)
  })

  it('ignora le parole da volantino', () => {
    const esito = agganciaOfferta('ZUCCHINE fresche italiane origine Italia 1 kg', ALIMENTI)

    assert.equal(esito?.alimentoId, 2)
    assert.ok(eCerta(esito!.confidenza))
  })
})
