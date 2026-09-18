import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Componente } from './modello'
import { ricalibra, scalaComponenti } from './ricalibra'

const cena: Componente[] = [
  { ruolo: 'base', alimentoId: 1, nome: 'Riso', quantita: 80, unita: 'g' },
  { ruolo: 'proteina', alimentoId: 2, nome: 'Pollo', quantita: 150, unita: 'g' },
  { ruolo: 'verdura', alimentoId: 3, nome: 'Zucchine', quantita: 200, unita: 'g' },
  { ruolo: 'grasso', alimentoId: 4, nome: 'Olio', quantita: 10, unita: 'g' },
]

describe('scalaComponenti', () => {
  it('lascia stare quando il fattore e vicino a 1', () => {
    assert.deepEqual(scalaComponenti(cena, 1.02), cena)
  })

  it('taglia prima il grasso e la base, non la proteina', () => {
    const tagliata = scalaComponenti(cena, 0.7)
    const per = (r: string) => tagliata.find((c) => c.ruolo === r)!.quantita
    const originale = (r: string) => cena.find((c) => c.ruolo === r)!.quantita

    const tagliaGrasso = 1 - per('grasso') / originale('grasso')
    const tagliaProteina = 1 - per('proteina') / originale('proteina')

    assert.ok(tagliaGrasso > tagliaProteina, 'il grasso deve cedere piu della proteina')
    assert.ok(per('proteina') >= 100, 'la proteina non deve crollare')
  })

  it('non taglia un componente oltre il 60%', () => {
    const tagliata = scalaComponenti(cena, 0.1)

    for (const c of tagliata) {
      const prima = cena.find((o) => o.ruolo === c.ruolo)!.quantita
      assert.ok(c.quantita >= prima * 0.4 - 5, `${c.ruolo} tagliato troppo`)
    }
  })

  it('quando aggiunge non sfonda: massimo una volta e mezza', () => {
    const cresciuta = scalaComponenti(cena, 4)

    for (const c of cresciuta) {
      const prima = cena.find((o) => o.ruolo === c.ruolo)!.quantita
      assert.ok(c.quantita <= prima * 1.5 + 5, `${c.ruolo} cresciuto troppo`)
    }
  })

  it('arrotonda a multipli di cinque', () => {
    for (const c of scalaComponenti(cena, 0.83)) {
      assert.equal(c.quantita % 5, 0, `${c.nome} non e multiplo di 5`)
    }
  })
})

describe('ricalibra', () => {
  const rimanenti = [{ id: 1, fascia: 'cena', componenti: cena, kcalPreviste: 700 }]

  it('non cambia niente quando il residuo combacia', () => {
    const esito = ricalibra(rimanenti, 700)

    assert.equal(esito.sforamento, 0)
    assert.ok(Math.abs(esito.fattore - 1) < 0.01)
  })

  it('taglia quando hai gia mangiato troppo', () => {
    const esito = ricalibra(rimanenti, 450)

    assert.ok(esito.fattore < 1)
    assert.equal(esito.sforamento, 0)
    assert.equal(esito.pasti[0]?.kcal, 450)
  })

  it('non scende sotto il minimo della fascia e dichiara lo sforamento', () => {
    const esito = ricalibra(rimanenti, 100)

    assert.equal(esito.pasti[0]?.kcal, 350, 'la cena resta una cena')
    assert.equal(esito.sforamento, 250, 'lo sforamento si dichiara')
  })

  it('con residuo negativo serve comunque il minimo', () => {
    const esito = ricalibra(rimanenti, -200)

    assert.equal(esito.pasti[0]?.kcal, 350)
    assert.equal(esito.sforamento, 550)
  })

  it('senza pasti rimasti riporta solo lo sforamento', () => {
    const esito = ricalibra([], -340)

    assert.deepEqual(esito.pasti, [])
    assert.equal(esito.sforamento, 340)
  })

  it('distribuisce il residuo su piu pasti', () => {
    const esito = ricalibra(
      [
        { id: 1, fascia: 'merenda', componenti: [], kcalPreviste: 200 },
        { id: 2, fascia: 'cena', componenti: cena, kcalPreviste: 600 },
      ],
      400,
    )

    const totale = esito.pasti.reduce((t, p) => t + p.kcal, 0)
    assert.ok(Math.abs(totale - 430) < 10, `totale ${totale}, atteso il minimo 430`)
  })
})
