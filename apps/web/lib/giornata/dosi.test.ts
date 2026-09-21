import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Alimento } from '@prontooo/db'

import { dosiRagionevoli } from './dosi'
import type { Componente } from './modello'

/** Quel tanto di alimento che serve a dosare: gruppo, porzione e calorie. */
function alimento(
  id: number,
  nome: string,
  gruppo: string,
  quantita: number,
  kcal: number,
): Alimento {
  return { id, nome, gruppo, quantita: String(quantita), kcal: String(kcal) } as unknown as Alimento
}

const OLIO = alimento(1, 'Olio extravergine di oliva', 'grasso', 10, 884)
const PASTA = alimento(2, 'Pasta di semola', 'cereale', 80, 353)
const PECORINO = alimento(3, 'Pecorino', 'latticino', 40, 387)
const ZUCCHINE = alimento(4, 'Zucchine', 'verdura', 200, 17)
const POLLO = alimento(5, 'Petto di pollo', 'carne', 150, 110)

const VOCABOLARIO = new Map(
  [OLIO, PASTA, PECORINO, ZUCCHINE, POLLO].map((a) => [a.id, a]),
)

function componente(a: Alimento, quantita: number): Componente {
  return { ruolo: 'base', alimentoId: a.id, nome: a.nome, quantita, unita: 'g' }
}

const grammiDi = (componenti: Componente[], nome: string) =>
  componenti.find((c) => c.nome === nome)?.quantita

describe('il condimento non decide il piatto', () => {
  it('taglia l’olio a una dose da persona', () => {
    // Il caso vero: pasta col pesto, e trenta grammi di olio in un piatto
    // solo. Sono 270 kcal, piu' della pasta.
    const dosate = dosiRagionevoli(
      [componente(OLIO, 30), componente(PASTA, 70), componente(ZUCCHINE, 100)],
      VOCABOLARIO,
    )

    assert.equal(grammiDi(dosate, 'Olio extravergine di oliva'), 15)
  })

  it('e lo dice, invece di farlo di nascosto', () => {
    const dosate = dosiRagionevoli([componente(OLIO, 30), componente(PASTA, 70)], VOCABOLARIO)

    assert.equal(dosate.find((c) => c.nome === 'Olio extravergine di oliva')?.ridotto, true)
    assert.equal(dosate.find((c) => c.nome === 'Pasta di semola')?.ridotto, undefined)
  })

  it('lascia stare l’olio quando ce n’e’ il giusto', () => {
    const dosate = dosiRagionevoli([componente(OLIO, 10), componente(PASTA, 80)], VOCABOLARIO)

    assert.deepEqual(dosate.map((c) => c.quantita), [10, 80])
  })

  it('non tocca l’ingrediente che regge il piatto', () => {
    // Centottanta grammi di pollo sono una porzione abbondante, non un
    // errore. Il tetto serve a fermare le esagerazioni, non a livellare.
    const dosate = dosiRagionevoli([componente(POLLO, 180), componente(ZUCCHINE, 250)], VOCABOLARIO)

    assert.deepEqual(dosate.map((c) => c.quantita), [180, 250])
  })
})

describe('le calorie tolte tornano nel piatto', () => {
  it('rimette sulla pasta quello che toglie all’olio', () => {
    // Togliere e basta darebbe un pranzo piu' magro e piu' corto: 135 kcal
    // in meno vuol dire alzarsi con fame, che e' il modo piu' sicuro di
    // mollare una dieta.
    const dosate = dosiRagionevoli(
      [componente(OLIO, 30), componente(PASTA, 70), componente(ZUCCHINE, 100)],
      VOCABOLARIO,
    )

    assert.ok((grammiDi(dosate, 'Pasta di semola') as number) > 70)
  })

  it('non le rimette sul condimento', () => {
    // Se tornassero li' il taglio si annullerebbe da solo.
    const dosate = dosiRagionevoli(
      [componente(OLIO, 40), componente(PASTA, 60)],
      VOCABOLARIO,
    )

    assert.equal(grammiDi(dosate, 'Olio extravergine di oliva'), 15)
  })

  it('non gonfia un ingrediente oltre il suo tetto', () => {
    // Il secondo passaggio e' vincolato quanto il primo, altrimenti si
    // toglierebbe l'olio per mettere in tavola 300 g di pasta.
    const dosate = dosiRagionevoli([componente(OLIO, 80), componente(PASTA, 60)], VOCABOLARIO)

    assert.ok((grammiDi(dosate, 'Pasta di semola') as number) <= 200)
  })

  it('e quando non c’e’ niente da tagliare non cambia niente', () => {
    const dosate = dosiRagionevoli(
      [componente(PASTA, 80), componente(ZUCCHINE, 150), componente(OLIO, 10)],
      VOCABOLARIO,
    )

    assert.deepEqual(dosate.map((c) => c.quantita), [80, 150, 10])
  })
})

describe('i grammi che non si pesano', () => {
  it('scrive q.b. invece di cinque grammi di formaggio', () => {
    // Tre formaggi da 5 g l'uno sono tre cose da comprare, pesare e usarne
    // un cucchiaino. Zero e' come l'app scrive gia' "q.b.".
    const dosate = dosiRagionevoli([componente(PECORINO, 5), componente(PASTA, 80)], VOCABOLARIO)

    assert.equal(grammiDi(dosate, 'Pecorino'), 0)
  })

  it('ma pesa quello che si pesa davvero', () => {
    // La pasta, il pane, la carne, il pesce: se vengono minuscoli il difetto
    // sta altrove, e un "q.b." lo nasconderebbe.
    const dosate = dosiRagionevoli([componente(PASTA, 15), componente(POLLO, 20)], VOCABOLARIO)

    assert.deepEqual(dosate.map((c) => c.quantita), [15, 20])
  })

  it('e una porzione vera resta un numero', () => {
    const dosate = dosiRagionevoli([componente(PECORINO, 30)], VOCABOLARIO)

    assert.equal(grammiDi(dosate, 'Pecorino'), 30)
  })
})

describe('quello che non sappiamo non lo tocchiamo', () => {
  it('lascia stare l’ingrediente che non e’ nel vocabolario', () => {
    // Senza la sua porzione non c'e' un metro, e inventarne uno vorrebbe
    // dire correggere a caso.
    const sconosciuto: Componente = {
      ruolo: 'base',
      alimentoId: null,
      nome: 'Da collegare',
      quantita: 120,
      unita: 'g',
    }

    assert.deepEqual(dosiRagionevoli([sconosciuto], VOCABOLARIO), [sconosciuto])
  })

  it('non inventa niente su un piatto vuoto', () => {
    assert.deepEqual(dosiRagionevoli([], VOCABOLARIO), [])
  })

  it('tiene i grammi a scalini di cinque', () => {
    for (const c of dosiRagionevoli(
      [componente(OLIO, 33), componente(PASTA, 71), componente(ZUCCHINE, 137)],
      VOCABOLARIO,
    )) {
      assert.equal(c.quantita % 5, 0, `${c.nome} sta a ${c.quantita} g`)
    }
  })
})

describe('il piatto intero, come arriva in tavola', () => {
  it('fa scendere i grassi sotto la meta’ del piatto', () => {
    // E' il pranzo vero da cui e' nato questo file: pasta col pesto, tre
    // formaggi e trenta grammi di olio. Il 57% delle calorie era grasso.
    // Il test non guarda i singoli grammi - quelli si possono tarare - ma
    // quello che finisce nel piatto, che e' l'unica cosa che conta.
    const piatto = [
      componente(PASTA, 70),
      componente(OLIO, 30),
      componente(PECORINO, 5),
      componente(ZUCCHINE, 60),
    ]

    const grassi = (cs: Componente[]) => {
      const kcal = cs.reduce(
        (s, c) => s + (Number(VOCABOLARIO.get(c.alimentoId as number)!.kcal) * c.quantita) / 100,
        0,
      )
      const daGrasso = cs.reduce((s, c) => {
        const a = VOCABOLARIO.get(c.alimentoId as number)!

        return a.gruppo === 'grasso' ? s + (Number(a.kcal) * c.quantita) / 100 : s
      }, 0)

      return daGrasso / kcal
    }

    const prima = grassi(piatto)
    const dopo = grassi(dosiRagionevoli(piatto, VOCABOLARIO))

    assert.ok(prima > 0.4, `prima il condimento era il ${Math.round(prima * 100)}%`)
    assert.ok(dopo < 0.3, `dopo e' ancora il ${Math.round(dopo * 100)}%`)
  })

  it('e non fa sparire le calorie dal pranzo', () => {
    // Un pranzo piu' magro e piu' corto non e' piu' sano: ti fa alzare con
    // fame, che e' il modo piu' sicuro di mollare una dieta.
    const piatto = [componente(PASTA, 70), componente(OLIO, 30), componente(PECORINO, 5)]

    const kcal = (cs: Componente[]) =>
      cs.reduce(
        (s, c) => s + (Number(VOCABOLARIO.get(c.alimentoId as number)!.kcal) * c.quantita) / 100,
        0,
      )

    const prima = kcal(piatto)
    const dopo = kcal(dosiRagionevoli(piatto, VOCABOLARIO))

    assert.ok(Math.abs(dopo - prima) / prima < 0.1, `da ${Math.round(prima)} a ${Math.round(dopo)} kcal`)
  })
})
