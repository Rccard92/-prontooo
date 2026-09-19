import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { VOCABOLARIO } from '@prontooo/db/alimenti'

import { CONDIZIONI, alimentiToccati, chiaveRegola, condizione } from './condizioni'

describe('le condizioni', () => {
  it('parlano solo di alimenti che esistono nel vocabolario', () => {
    const nomi = new Set(VOCABOLARIO.map((a) => a.nome))
    const fantasmi: string[] = []

    for (const c of CONDIZIONI) {
      for (const r of c.regole) {
        for (const nome of r.alimenti) {
          if (!nomi.has(nome)) fantasmi.push(`${c.id}.${r.id}: ${nome}`)
        }
      }
    }

    // Una regola che nomina un alimento inesistente non fa niente e non si
    // vede: resta li' a dare l'impressione che la condizione stia lavorando.
    assert.deepEqual(fantasmi, [])
  })

  it('non escludono niente in modo rigido', () => {
    // Una patologia inclina, non vieta. Il divieto sta fra le esclusioni, che
    // le scegli tu, e non si accende da solo per una diagnosi.
    for (const c of CONDIZIONI) {
      for (const r of c.regole) {
        assert.ok(['di_rado', 'piu_spesso'].includes(r.verso), `${c.id}.${r.id}`)
      }
    }
  })

  it('dicono sempre cosa fanno e quanto si sa', () => {
    for (const c of CONDIZIONI) {
      assert.ok(c.spiega.length > 10, `${c.id} senza spiegazione`)

      for (const r of c.regole) {
        assert.ok(r.cosaFa.length > 10, `${c.id}.${r.id} non dice cosa fa`)
        assert.ok(r.quantoSiSa.length > 20, `${c.id}.${r.id} non dice quanto si sa`)
      }
    }
  })

  it('non hanno id ripetuti', () => {
    const ids = CONDIZIONI.map((c) => c.id)

    assert.equal(new Set(ids).size, ids.length)

    for (const c of CONDIZIONI) {
      const regole = c.regole.map((r) => r.id)

      assert.equal(new Set(regole).size, regole.length, `${c.id} ripete una regola`)
    }
  })
})

describe('alimentiToccati', () => {
  it('raccoglie gli alimenti delle condizioni accese', () => {
    const { diRado, piuSpesso } = alimentiToccati(['hashimoto'])

    assert.ok(diRado.has('Tofu'))
    assert.ok(piuSpesso.has('Uova'))
  })

  it('non tocca niente se non accendi niente', () => {
    const { diRado, piuSpesso } = alimentiToccati([])

    assert.equal(diRado.size, 0)
    assert.equal(piuSpesso.size, 0)
  })

  it('salta la regola che hai spento, tenendo le altre', () => {
    const { diRado, piuSpesso } = alimentiToccati(
      ['hashimoto'],
      [chiaveRegola('hashimoto', 'soia')],
    )

    assert.equal(diRado.has('Tofu'), false)
    assert.ok(piuSpesso.has('Uova'), 'le altre regole restano')
  })

  it('fra due condizioni in disaccordo sceglie la prudente', () => {
    // Hashimoto vuole piu' pesce, il reflusso non lo tocca: per costruire il
    // caso si guarda un alimento che una regola alza e un altra abbassa.
    const { diRado, piuSpesso } = alimentiToccati(['hashimoto', 'colesterolo', 'pressione'])

    for (const nome of diRado) {
      assert.equal(piuSpesso.has(nome), false, `${nome} sta in tutt'e due`)
    }
  })

  it('ignora una condizione che non esiste', () => {
    assert.equal(alimentiToccati(['non-esiste']).diRado.size, 0)
    assert.equal(condizione('non-esiste'), null)
  })
})
