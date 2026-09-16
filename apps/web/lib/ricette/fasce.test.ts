import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { classifica } from './fasce'

describe('classifica', () => {
  it('riconosce i primi e li mette a pranzo e a cena', () => {
    const esito = classifica('Primi piatti', 'https://x.it/ricette/pasta-alla-norma')
    assert.equal(esito.ruolo, 'primo')
    assert.deepEqual(esito.fasce, ['pranzo', 'cena'])
  })

  it('riconosce i secondi', () => {
    assert.equal(classifica('Secondi piatti', 'https://x.it/r/1').ruolo, 'secondo')
    assert.equal(classifica('Carne', 'https://x.it/r/1').ruolo, 'secondo')
  })

  it('manda i dolci a colazione e merenda, non a cena', () => {
    const esito = classifica('Dolci', 'https://x.it/r/torta-di-mele')
    assert.equal(esito.ruolo, 'dolce')
    assert.deepEqual(esito.fasce, ['colazione', 'merenda'])
  })

  it('le torte salate sono secondi, non dolci', () => {
    assert.equal(classifica('Torte salate', 'https://x.it/r/1').ruolo, 'secondo')
  })

  it('antipasti e contorni restano fuori dal piano', () => {
    assert.deepEqual(classifica('Antipasti', 'https://x.it/r/1').fasce, [])
    assert.deepEqual(classifica('Contorni', 'https://x.it/r/1').fasce, [])
  })

  it('usa l indirizzo quando la categoria manca', () => {
    assert.equal(classifica(null, 'https://x.it/ricette/primi-piatti/carbonara').ruolo, 'primo')
    assert.equal(classifica(null, 'https://x.it/ricette/dolci/tiramisu').ruolo, 'dolce')
  })

  it('non inventa un ruolo quando non capisce', () => {
    const esito = classifica('Ricette della nonna', 'https://x.it/r/4231')
    assert.equal(esito.ruolo, null)
    assert.deepEqual(esito.fasce, [])
  })
})
