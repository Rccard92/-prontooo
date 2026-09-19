import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { NUTRIENTI } from './nutrienti'
import { OCCASIONALI } from './occasionali'
import { ETICHETTE, FASCE_PASTO, GRUPPI, RUOLI_PASTO } from './tipi'
import { VOCABOLARIO } from './vocabolario'

describe('il vocabolario', () => {
  it('non ha due alimenti con lo stesso nome', () => {
    // Il seed inserisce tutto in un colpo solo con ON CONFLICT sul nome, e
    // Postgres rifiuta un comando che tocca la stessa riga due volte
    // (errore 21000). Un doppione qui dentro non rompe il typecheck ne' la
    // build: rompe il deploy, davanti al database. E' successo con "Pane di
    // segale", aggiunto una seconda volta senza accorgersene.
    const conta = new Map<string, number>()

    for (const a of VOCABOLARIO) conta.set(a.nome, (conta.get(a.nome) ?? 0) + 1)

    assert.deepEqual(
      [...conta.entries()].filter(([, quante]) => quante > 1).map(([nome]) => nome),
      [],
    )
  })

  it('ha i valori nutrizionali per ogni voce', () => {
    assert.deepEqual(
      VOCABOLARIO.filter((a) => !NUTRIENTI.has(a.nome)).map((a) => a.nome),
      [],
    )
  })

  it('non ha nutrienti per alimenti che non esistono', () => {
    const nomi = new Set(VOCABOLARIO.map((a) => a.nome))

    assert.deepEqual([...NUTRIENTI.keys()].filter((n) => !nomi.has(n)), [])
  })

  it('marca come occasionali solo alimenti che esistono', () => {
    const nomi = new Set(VOCABOLARIO.map((a) => a.nome))

    assert.deepEqual(OCCASIONALI.filter((n) => !nomi.has(n)), [])
  })

  it('non marca occasionale tutto un gruppo: resterebbe senza niente da proporre', () => {
    const per = new Map<string, { totale: number; rari: number }>()

    for (const a of VOCABOLARIO) {
      const conto = per.get(a.gruppo) ?? { totale: 0, rari: 0 }

      conto.totale += 1
      if (OCCASIONALI.includes(a.nome)) conto.rari += 1
      per.set(a.gruppo, conto)
    }

    for (const [gruppo, { totale, rari }] of per) {
      assert.ok(rari < totale, `${gruppo}: tutti e ${totale} marcati occasionali`)
    }
  })

  it('usa solo gruppi, ruoli, fasce ed etichette dichiarati', () => {
    for (const a of VOCABOLARIO) {
      assert.ok(GRUPPI.includes(a.gruppo), `${a.nome}: gruppo ${a.gruppo}`)
      assert.ok(a.ruoli.length > 0, `${a.nome} non copre nessun ruolo`)

      for (const r of a.ruoli) assert.ok(RUOLI_PASTO.includes(r), `${a.nome}: ruolo ${r}`)
      for (const f of a.fasce) assert.ok(FASCE_PASTO.includes(f), `${a.nome}: fascia ${f}`)
      for (const e of a.etichette ?? []) assert.ok(ETICHETTE.includes(e), `${a.nome}: etichetta ${e}`)
    }
  })

  it('da a ogni alimento una fascia e una porzione sensata', () => {
    for (const a of VOCABOLARIO) {
      assert.ok(a.fasce.length > 0, `${a.nome} non sta in nessun pasto`)
      assert.ok(a.quantita > 0 && a.quantita <= 1000, `${a.nome}: ${a.quantita} ${a.unita}`)
    }
  })
})
