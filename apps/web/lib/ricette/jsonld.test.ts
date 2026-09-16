import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { estraiRicetta, minutiDaDurata, porzioniDaValore, ripulisci } from './jsonld'

function pagina(jsonLd: unknown, extra = ''): string {
  return `<!doctype html><html><head>${extra}
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    </head><body></body></html>`
}

describe('minutiDaDurata', () => {
  it('legge le durate ISO 8601 di schema.org', () => {
    assert.equal(minutiDaDurata('PT30M'), 30)
    assert.equal(minutiDaDurata('PT1H'), 60)
    assert.equal(minutiDaDurata('PT1H30M'), 90)
    assert.equal(minutiDaDurata('P0DT2H15M'), 135)
    assert.equal(minutiDaDurata('PT2H30M15S'), 150)
  })

  it('tratta zero e spazzatura come assenza di dato', () => {
    assert.equal(minutiDaDurata('PT0M'), null)
    assert.equal(minutiDaDurata('30 minuti'), null)
    assert.equal(minutiDaDurata(undefined), null)
    assert.equal(minutiDaDurata(''), null)
  })
})

describe('porzioniDaValore', () => {
  it('tira fuori il numero da come lo scrivono i siti', () => {
    assert.equal(porzioniDaValore(4), 4)
    assert.equal(porzioniDaValore('4'), 4)
    assert.equal(porzioniDaValore('4 persone'), 4)
    assert.equal(porzioniDaValore(['6', '6 porzioni']), 6)
    assert.equal(porzioniDaValore('per 4-6 persone'), 4)
  })

  it('scarta i valori che non sono porzioni', () => {
    assert.equal(porzioniDaValore('q.b.'), null)
    assert.equal(porzioniDaValore(0), null)
    assert.equal(porzioniDaValore('500'), null)
  })
})

describe('ripulisci', () => {
  it('toglie i tag e scioglie le entita', () => {
    assert.equal(ripulisci('<p>Pasta &amp; fagioli</p>'), 'Pasta & fagioli')
    assert.equal(ripulisci('Cuocere<br>poi scolare'), 'Cuocere poi scolare')
    assert.equal(ripulisci('Perch&eacute; no'), 'Perché no')
    assert.equal(ripulisci('180&deg;C'), '180°C')
    assert.equal(ripulisci('  troppi   spazi  '), 'troppi spazi')
  })
})

describe('estraiRicetta', () => {
  const base = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Pasta alla Norma',
    description: 'Il piatto catanese.',
    image: 'https://esempio.it/norma.jpg',
    prepTime: 'PT20M',
    cookTime: 'PT25M',
    recipeYield: '4 persone',
    recipeCategory: 'Primi piatti',
    recipeIngredient: ['320 g di sedanini', '2 melanzane', '100 g di ricotta salata'],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Friggere le melanzane.' },
      { '@type': 'HowToStep', text: 'Cuocere la pasta.' },
    ],
  }

  it('legge una ricetta completa', () => {
    const ricetta = estraiRicetta(pagina(base), 'https://www.esempio.it/pasta-alla-norma')

    assert.ok(ricetta)
    assert.equal(ricetta.titolo, 'Pasta alla Norma')
    assert.equal(ricetta.fonteNome, 'esempio.it')
    assert.equal(ricetta.immagineUrl, 'https://esempio.it/norma.jpg')
    assert.equal(ricetta.minutiPreparazione, 20)
    assert.equal(ricetta.minutiCottura, 25)
    assert.equal(ricetta.porzioni, 4)
    assert.equal(ricetta.categoriaFonte, 'Primi piatti')
    assert.deepEqual(ricetta.ingredienti, [
      '320 g di sedanini',
      '2 melanzane',
      '100 g di ricotta salata',
    ])
    assert.deepEqual(ricetta.passaggi, ['Friggere le melanzane.', 'Cuocere la pasta.'])
  })

  it('somma prep e cottura quando totalTime manca', () => {
    const ricetta = estraiRicetta(pagina(base), 'https://www.esempio.it/x')
    assert.equal(ricetta?.minutiTotali, 45)
  })

  it('preferisce totalTime quando c e', () => {
    const ricetta = estraiRicetta(
      pagina({ ...base, totalTime: 'PT1H' }),
      'https://www.esempio.it/x',
    )
    assert.equal(ricetta?.minutiTotali, 60)
  })

  it('trova la ricetta dentro @graph', () => {
    const dati = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, base] }
    assert.equal(estraiRicetta(pagina(dati), 'https://x.it/y')?.titolo, 'Pasta alla Norma')
  })

  it('trova la ricetta quando il blocco e un array', () => {
    assert.ok(estraiRicetta(pagina([{ '@type': 'Organization' }, base]), 'https://x.it/y'))
  })

  it('accetta @type multiplo', () => {
    const dati = { ...base, '@type': ['Recipe', 'NewsArticle'] }
    assert.ok(estraiRicetta(pagina(dati), 'https://x.it/y'))
  })

  it('salta i blocchi rotti e usa quello buono', () => {
    const html = `<html><head>
      <script type="application/ld+json">{ questo non e json }</script>
      <script type="application/ld+json">${JSON.stringify(base)}</script>
      </head></html>`
    assert.equal(estraiRicetta(html, 'https://x.it/y')?.titolo, 'Pasta alla Norma')
  })

  it('prende la prima immagine quando sono piu di una', () => {
    const dati = { ...base, image: ['https://a.it/1.jpg', 'https://a.it/2.jpg'] }
    assert.equal(estraiRicetta(pagina(dati), 'https://x.it/y')?.immagineUrl, 'https://a.it/1.jpg')
  })

  it('legge l immagine come ImageObject', () => {
    const dati = { ...base, image: { '@type': 'ImageObject', url: 'https://a.it/o.jpg' } }
    assert.equal(estraiRicetta(pagina(dati), 'https://x.it/y')?.immagineUrl, 'https://a.it/o.jpg')
  })

  it('appiattisce le istruzioni divise in sezioni', () => {
    const dati = {
      ...base,
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'Il sugo',
          itemListElement: [{ '@type': 'HowToStep', text: 'Soffriggere.' }],
        },
        {
          '@type': 'HowToSection',
          itemListElement: [{ '@type': 'HowToStep', text: 'Impiattare.' }],
        },
      ],
    }
    assert.deepEqual(estraiRicetta(pagina(dati), 'https://x.it/y')?.passaggi, [
      'Soffriggere.',
      'Impiattare.',
    ])
  })

  it('spezza le istruzioni scritte come testo unico', () => {
    const dati = { ...base, recipeInstructions: 'Lavare le verdure. Tagliarle a cubetti.' }
    assert.deepEqual(estraiRicetta(pagina(dati), 'https://x.it/y')?.passaggi, [
      'Lavare le verdure.',
      'Tagliarle a cubetti.',
    ])
  })

  it('rifiuta una ricetta senza ingredienti', () => {
    const { recipeIngredient, ...senzaIngredienti } = base
    assert.equal(estraiRicetta(pagina(senzaIngredienti), 'https://x.it/y'), null)
  })

  it('rifiuta una pagina senza JSON-LD', () => {
    assert.equal(estraiRicetta('<html><body>niente</body></html>', 'https://x.it/y'), null)
  })

  it('rifiuta una pagina che dichiara altro', () => {
    const dati = { '@type': 'Article', headline: 'Non e una ricetta' }
    assert.equal(estraiRicetta(pagina(dati), 'https://x.it/y'), null)
  })
})
