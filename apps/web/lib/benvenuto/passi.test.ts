import assert from 'node:assert/strict'
import { test } from 'node:test'

import { PASSI, PASSI_TOTALI, SOTTOTITOLO, TITOLO, ePasso, numeroDi, prossimo } from './passi'

test('ogni passo ha un titolo e un sottotitolo', () => {
  for (const passo of PASSI) {
    assert.ok(TITOLO[passo].length > 0, `${passo} senza titolo`)
    assert.ok(SOTTOTITOLO[passo].length > 0, `${passo} senza sottotitolo`)
  }
})

test('la catena dei passi arriva in fondo senza anelli', () => {
  const visti = new Set<string>()
  let passo: (typeof PASSI)[number] | null = PASSI[0]!

  while (passo) {
    assert.ok(!visti.has(passo), `ci si ripassa da ${passo}`)
    visti.add(passo)
    passo = prossimo(passo)
  }

  assert.equal(visti.size, PASSI.length)
})

test("l'ultimo passo non ne ha uno dopo: da li' si va agli ingredienti", () => {
  assert.equal(prossimo(PASSI[PASSI.length - 1]!), null)
})

test('i numeri partono da uno e la spunta degli ingredienti e’ quello in piu’', () => {
  assert.equal(numeroDi(PASSI[0]!), 1)
  assert.equal(numeroDi(PASSI[PASSI.length - 1]!), PASSI.length)
  assert.equal(PASSI_TOTALI, PASSI.length + 1)
})

test('ePasso riconosce solo i passi veri', () => {
  assert.ok(ePasso('corpo'))
  assert.ok(!ePasso('corpi'))
  assert.ok(!ePasso(''))
})
