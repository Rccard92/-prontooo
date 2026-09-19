import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ATTENUAZIONI,
  attive,
  leggiCosaTogliere,
  preferiSenza,
  senzaLeEscluse,
} from './attenuazioni'
import { ESCLUSIONI } from './impostazioni'

describe('le attenuazioni', () => {
  it('nominano etichette che esistono anche fra le esclusioni', () => {
    // Un’attenuazione e’ la via di mezzo di un’esclusione: se l’etichetta
    // non e’ escludibile, la via di mezzo non e’ in mezzo a niente.
    for (const a of ATTENUAZIONI) {
      assert.ok(
        ESCLUSIONI.some((e) => e.id === a.etichetta),
        `${a.etichetta} non e' fra le esclusioni`,
      )
    }
  })

  it('dicono tutte cosa fanno e quanto si sa', () => {
    for (const a of ATTENUAZIONI) {
      assert.ok(a.cosaFa.length > 0 && a.quantoSiSa.length > 0, `${a.etichetta} muta`)
    }
  })

  it('separa i due modi, che fanno cose diverse', () => {
    assert.deepEqual(attive(['glutine', 'lattosio'], 'riduci'), ['glutine'])
    assert.deepEqual(attive(['glutine', 'lattosio'], 'sostituisci'), ['lattosio'])
    assert.deepEqual(attive([], 'riduci'), [])
  })

  it('lascia vincere l’esclusione, che e’ la scelta piu’ netta', () => {
    assert.deepEqual(senzaLeEscluse(['glutine', 'lattosio'], ['glutine']), ['lattosio'])
    assert.deepEqual(senzaLeEscluse(['lattosio'], []), ['lattosio'])
  })
})

describe('ridurre senza togliere', () => {
  const porta = (n: string) => n.startsWith('G')

  it('toglie quelle con l’etichetta quando ne restano altre', () => {
    assert.deepEqual(preferiSenza(['Gnocchi', 'Riso', 'Patate'], porta), ['Riso', 'Patate'])
  })

  it('le tiene tutte quando toglierle lascerebbe il piatto vuoto', () => {
    // Il punto della riduzione: meglio il pane per la terza volta che un
    // pranzo senza base. Lo zero assoluto si chiede con l'esclusione.
    assert.deepEqual(preferiSenza(['Gnocchi', 'Grissini'], porta), ['Gnocchi', 'Grissini'])
  })

  it('non tocca niente quando nessuna porta l’etichetta', () => {
    assert.deepEqual(preferiSenza(['Riso', 'Patate'], porta), ['Riso', 'Patate'])
  })
})

describe('leggere cosa togliere dal form', () => {
  const da = (campi: Record<string, string>) => (campo: string) => campi[campo] ?? null

  it('manda la via di mezzo fra le attenuazioni, non fra le esclusioni', () => {
    const esito = leggiCosaTogliere(da({ 'modo-glutine': 'attenua' }))

    assert.deepEqual(esito.attenuazioni, ['glutine'])
    assert.deepEqual(esito.esclusioni, [])
  })

  it('manda "toglilo del tutto" fra le esclusioni, che restano rigide', () => {
    const esito = leggiCosaTogliere(da({ 'modo-lattosio': 'togli' }))

    assert.deepEqual(esito.esclusioni, ['lattosio'])
    assert.deepEqual(esito.attenuazioni, [])
  })

  it('non segna niente per chi ha risposto "lo mangio"', () => {
    const esito = leggiCosaTogliere(da({ 'modo-glutine': 'no', 'modo-lattosio': 'no' }))

    assert.deepEqual(esito.esclusioni, [])
    assert.deepEqual(esito.attenuazioni, [])
  })

  it('legge le altre etichette dalla casella, che non hanno vie di mezzo', () => {
    const esito = leggiCosaTogliere(da({ 'esclusione-pesce': 'si', 'esclusione-uova': 'si' }))

    assert.deepEqual(esito.esclusioni.sort(), ['pesce', 'uova'])
  })

  it('su un form vuoto non toglie niente a nessuno', () => {
    const esito = leggiCosaTogliere(() => null)

    assert.deepEqual(esito.esclusioni, [])
    assert.deepEqual(esito.attenuazioni, [])
  })
})
