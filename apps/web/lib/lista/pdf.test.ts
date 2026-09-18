import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { agganciaAlimento, leggiDieta, spezzaAlternativa } from './pdf'

const DIETA = `
LUNEDÌ

COLAZIONE
- Yogurt greco 5% alla frutta 150g o Yogurt greco 0% 150g
- Corn flakes 20g o Fiocchi di avena 20g
- Semi di chia 10g o Semi di lino 10g
SPUNTINO
- Mela (con buccia) 150g o Kiwi 150g
PRANZO
PIATTO UNICO
- Riso integrale 80g o Pasta di semola integrale 80g
- Peperone 150g o Fagiolini 150g o Zucchine 150g
- Olio di oliva extra vergine 10g
CENA
- Patate 200g
- Vitello (fettina) 150g o Pollo (petto) 150g
- Spinaci 200g
- Olio di oliva extra vergine 5g

MARTEDÌ

COLAZIONE
- Latte di mucca intero senza lattosio 200ml
- Fette biscottate integrali 20g
PRANZO
- Patate 200g o Patate dolci 200g
- Pesce azzurro 300g
- Olio di oliva extra vergine 10g
`

describe('spezzaAlternativa', () => {
  it('separa nome e quantita', () => {
    assert.deepEqual(spezzaAlternativa('Riso integrale 80g'), {
      nome: 'Riso integrale',
      quantita: 80,
      unita: 'g',
    })
  })

  it('riconosce i millilitri', () => {
    assert.equal(spezzaAlternativa('Latte intero 200ml')?.unita, 'ml')
  })

  it('tiene le parentesi dentro il nome', () => {
    assert.equal(spezzaAlternativa('Mela (con buccia) 150g')?.nome, 'Mela (con buccia)')
  })

  it('accetta la virgola nei decimali', () => {
    assert.equal(spezzaAlternativa('Olio evo 7,5g')?.quantita, 7.5)
  })

  it('rifiuta una riga senza quantita', () => {
    assert.equal(spezzaAlternativa('Verdure a piacere'), null)
    assert.equal(spezzaAlternativa('q.b.'), null)
  })
})

describe('leggiDieta', () => {
  const esito = leggiDieta(DIETA)

  it('trova i giorni', () => {
    assert.equal(esito.giorniTrovati, 2)
  })

  it('assegna ogni voce alla sua fascia', () => {
    const fasce = new Set(esito.voci.map((v) => v.fascia))
    assert.deepEqual([...fasce].sort(), ['cena', 'colazione', 'pranzo', 'spuntino'])
  })

  it('tiene insieme le alternative della stessa riga', () => {
    const colazione = esito.voci.filter((v) => v.fascia === 'colazione')
    const riga0 = colazione.filter((v) => v.riga === 0).map((v) => v.testo)
    assert.deepEqual(riga0, ['Yogurt greco 5% alla frutta', 'Yogurt greco 0%'])
  })

  it('spezza le alternative multiple', () => {
    const pranzo = esito.voci.filter((v) => v.fascia === 'pranzo')
    const verdure = pranzo.filter((v) => v.testo === 'Zucchine')
    assert.equal(verdure.length, 1)
  })

  it('salta i sottotitoli come PIATTO UNICO', () => {
    assert.ok(!esito.voci.some((v) => v.testo.toUpperCase().includes('PIATTO UNICO')))
  })

  it('non ripete la stessa alternativa vista in due giorni', () => {
    const olio = esito.voci.filter((v) => v.fascia === 'pranzo' && v.testo.startsWith('Olio'))
    assert.equal(olio.length, 1)
  })

  it('fonde i giorni tenendo le alternative nuove', () => {
    const pranzo = esito.voci.filter((v) => v.fascia === 'pranzo').map((v) => v.testo)
    assert.ok(pranzo.includes('Riso integrale'))
    assert.ok(pranzo.includes('Patate dolci'))
    assert.ok(pranzo.includes('Pesce azzurro'))
  })

  it('legge le quantita in millilitri', () => {
    const latte = esito.voci.find((v) => v.testo.startsWith('Latte'))
    assert.equal(latte?.quantita, 200)
    assert.equal(latte?.unita, 'ml')
  })

  it('tiene le righe senza quantita come "a piacere"', () => {
    const con = leggiDieta('PRANZO\n- Verdure crude a piacere\n- Riso integrale 80g')
    const libera = con.voci.find((v) => v.aPiacere)

    assert.equal(con.scartate.length, 0)
    assert.equal(con.voci.length, 2)
    assert.equal(libera?.testo, 'Verdure crude')
    assert.equal(libera?.quantita, 0)
  })

  it('tiene le alternative a piacere sulla stessa riga', () => {
    const con = leggiDieta('CENA\n- Rucola o Valeriana')
    assert.equal(con.voci.length, 2)
    assert.equal(con.voci[0]?.riga, con.voci[1]?.riga)
  })

  it('scarta le note del nutrizionista, non gli alimenti', () => {
    const con = leggiDieta('PRANZO\n- Bere almeno due litri di acqua al giorno\n- Limone q.b.')
    assert.equal(con.scartate.length, 1)
    assert.equal(con.voci[0]?.testo, 'Limone')
  })
})

describe('agganciaAlimento', () => {
  const vocabolario = [
    { id: 1, nome: 'Riso integrale' },
    { id: 2, nome: 'Yogurt greco 5%' },
    { id: 3, nome: 'Petto di pollo' },
    { id: 4, nome: "Fiocchi d'avena" },
    { id: 5, nome: 'Olio extravergine di oliva' },
    { id: 6, nome: 'Fettina di vitello' },
  ]

  it('aggancia il nome esatto', () => {
    assert.equal(agganciaAlimento('Riso integrale', vocabolario), 1)
  })

  it('aggancia ignorando accenti e apostrofi', () => {
    assert.equal(agganciaAlimento('Fiocchi di avena', vocabolario), 4)
  })

  it('aggancia un nome piu lungo al suo alimento', () => {
    assert.equal(agganciaAlimento('Yogurt greco 5% alla frutta', vocabolario), 2)
  })

  it('aggancia le parole invertite', () => {
    assert.equal(agganciaAlimento('Pollo (petto)', vocabolario), 3)
    assert.equal(agganciaAlimento('Vitello (fettina)', vocabolario), 6)
  })

  it('non inventa un aggancio quando non sa', () => {
    assert.equal(agganciaAlimento('Seitan affumicato', vocabolario), null)
  })
})
