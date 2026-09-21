import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { numeroDiRicetta, scalaRicetta } from './daRicetta'
import type { Componente } from './modello'

const BACCALA: Componente[] = [
  { ruolo: 'proteina', alimentoId: 20, nome: 'Baccala', quantita: 600, unita: 'g' },
  { ruolo: 'base', alimentoId: 10, nome: 'Patate', quantita: 800, unita: 'g' },
  { ruolo: 'grasso', alimentoId: 30, nome: 'Olio extravergine di oliva', quantita: 40, unita: 'g' },
]

describe('scalare una ricetta', () => {
  it('tocca tutti gli ingredienti nella stessa misura', () => {
    // E' la differenza con la ricalibrazione, che taglia dai grassi prima che
    // dalla proteina. Su un elenco di componenti va bene; su una ricetta di
    // qualcun altro vuol dire cambiargliela: meno olio e stesso pesce non e'
    // piu' quel piatto.
    const scalata = scalaRicetta(BACCALA, 0.5)
    const rapporti = scalata.map((c, i) => c.quantita / BACCALA[i]!.quantita)

    for (const rapporto of rapporti) {
      assert.ok(Math.abs(rapporto - 0.5) < 0.15, `un ingrediente e' stato scalato di ${rapporto}`)
    }
  })

  it('porta davvero le calorie dove servono', () => {
    // Il caso vero: una ricetta per quattro che deve diventare un pasto.
    const per4 = 2400
    const bersaglio = 700
    const scalata = scalaRicetta(BACCALA, bersaglio / per4)
    const grammiPrima = BACCALA.reduce((t, c) => t + c.quantita, 0)
    const grammiDopo = scalata.reduce((t, c) => t + c.quantita, 0)

    assert.ok(grammiDopo < grammiPrima / 2, 'la porzione per quattro e’ rimasta per quattro')
  })

  it('non scende sotto un quinto ne’ sale oltre il doppio', () => {
    // Fuori da li' non stai scalando una ricetta, ne stai cucinando un'altra:
    // 600 g di baccala' che diventano 30 non sono una porzione, sono un
    // errore di conto travestito.
    const minuscola = scalaRicetta(BACCALA, 0.01)
    const enorme = scalaRicetta(BACCALA, 10)

    assert.ok(minuscola[0]!.quantita >= BACCALA[0]!.quantita * 0.2 * 0.95)
    assert.ok(enorme[0]!.quantita <= BACCALA[0]!.quantita * 2 * 1.05)
  })

  it('lascia stare quello che e’ gia’ giusto', () => {
    assert.deepEqual(scalaRicetta(BACCALA, 1), BACCALA)
    assert.deepEqual(scalaRicetta(BACCALA, 1.02), BACCALA)
  })

  it('non porta niente a zero', () => {
    // Un ingrediente a zero grammi sparisce dalla lista della spesa e dal
    // piatto: la ricetta resterebbe col suo nome e senza una delle sue cose.
    const scalata = scalaRicetta(BACCALA, 0.2)

    assert.ok(scalata.every((c) => c.quantita >= 5))
  })
})

describe('riconoscere una ricetta del catalogo', () => {
  it('prende il numero dagli id col prefisso', () => {
    assert.equal(numeroDiRicetta('catalogo-812'), 812)
  })

  it('e dice di no a tutto il resto', () => {
    // Gli id del libro scritto a mano non hanno prefisso, e non devono
    // finire in una query come se fossero numeri.
    for (const id of ['pasta-legumi', 'catalogo-', 'catalogo-abc', '', null, undefined]) {
      assert.equal(numeroDiRicetta(id), null, `${String(id)} e’ passato`)
    }
  })
})
