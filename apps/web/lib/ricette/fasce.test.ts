import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RUOLI_IN_CATALOGO, classifica, daTenereInCatalogo } from './fasce'

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

describe('cosa tiene il catalogo', () => {
  it('tiene solo quello che puo’ reggere un pranzo o una cena', () => {
    // La regola che deve valere sempre: se una ricetta entra in catalogo deve
    // poter finire in un pasto vero. Altrimenti e' peso morto che occupa il
    // budget del catalogo e che poi si paga per leggerlo.
    for (const categoria of ['Primi piatti', 'Secondi piatti', 'Piatti unici', 'Torte salate']) {
      const esito = classifica(categoria, '')

      assert.ok(RUOLI_IN_CATALOGO.includes(esito.ruolo!), `${categoria} resta fuori dal catalogo`)
      assert.ok(
        esito.fasce.includes('pranzo') || esito.fasce.includes('cena'),
        `${categoria} e' in catalogo ma non va ne' a pranzo ne' a cena`,
      )
    }
  })

  it('lascia fuori i dolci', () => {
    // Scelta esplicita: la colazione l'app la compone dai tuoi alimenti, e un
    // catalogo di crostate erano soldi da leggere per ricette mai proposte.
    assert.equal(daTenereInCatalogo(classifica('Dolci', '').ruolo), false)
    assert.equal(daTenereInCatalogo(classifica('Torte', '').ruolo), false)
    assert.equal(daTenereInCatalogo(classifica('Biscotti', '').ruolo), false)
  })

  it('lascia fuori anche quello che un pasto non lo fa da solo', () => {
    assert.equal(daTenereInCatalogo(classifica('Antipasti', '').ruolo), false)
    assert.equal(daTenereInCatalogo(classifica('Contorni', '').ruolo), false)
    assert.equal(daTenereInCatalogo(classifica('Bevande', '').ruolo), false)
    assert.equal(daTenereInCatalogo(null), false)
  })

  it('tiene primi, secondi e piatti unici', () => {
    assert.equal(daTenereInCatalogo(classifica('Primi piatti', '').ruolo), true)
    assert.equal(daTenereInCatalogo(classifica('Secondi piatti', '').ruolo), true)
    assert.equal(daTenereInCatalogo(classifica('Piatti unici', '').ruolo), true)
    assert.equal(daTenereInCatalogo(classifica('Torte salate', '').ruolo), true)
  })
})

describe('quando la fonte non dichiara la categoria', () => {
  // I casi veri presi dal sondaggio di Cookaround: indirizzi tipo
  // /ricetta/nome.html, nessuna sezione nel percorso, nessuna categoria.
  // Prima finivano tutti fra le non classificabili e venivano scartati.
  const daTitolo = (titolo: string, url: string) => classifica(null, url, titolo)

  it('riconosce un secondo dal titolo', () => {
    assert.equal(
      daTitolo('Cotolette di cinghiale', 'https://www.cookaround.com/ricetta/cotolette-di-cinghiale.html')
        .ruolo,
      'secondo',
    )
    assert.equal(
      daTitolo('Coda alla vaccinara', 'https://www.cookaround.com/ricetta/coda-alla-vaccinara.html')
        .ruolo,
      'secondo',
    )
    assert.equal(
      daTitolo(
        'Cosce di tacchino al forno con cipolle',
        'https://www.cookaround.com/ricetta/cosce-di-tacchino-al-forno-con-cipolle.html',
      ).ruolo,
      'secondo',
    )
  })

  it('riconosce un primo dal titolo', () => {
    assert.equal(
      daTitolo(
        'Zuppa rustica con misticanza',
        'https://www.cookaround.com/ricetta/Zuppa-rustica-con-misticanza.html',
      ).ruolo,
      'primo',
    )
    assert.equal(
      daTitolo(
        'Pasta risottata asparagi e zafferano',
        'https://www.cookaround.com/ricetta/pasta-risottata-asparagi-zafferano-cremosa.html',
      ).ruolo,
      'primo',
    )
  })

  it('tiene i dolci fuori anche quando arrivano dal titolo', () => {
    assert.equal(daTitolo('Torta di rose', 'https://x.it/ricetta/Torta-di-rose.html').ruolo, 'dolce')
    assert.equal(daTenereInCatalogo(daTitolo('Aspic di frutta', 'https://x.it/r.html').ruolo), false)
  })

  it('prende i singolari, non solo i plurali', () => {
    // "zuppe" c'era, "zuppa" no. "focacce" c'era, "focaccia" no. Erano le
    // parole che i titoli usano davvero.
    assert.equal(classifica(null, '', 'Zuppa di ceci').ruolo, 'primo')
    assert.equal(classifica(null, '', 'Focaccia con formaggio').ruolo, 'lievitato')
    assert.equal(classifica(null, '', 'Frittata di zucchine').ruolo, 'secondo')
  })
})
