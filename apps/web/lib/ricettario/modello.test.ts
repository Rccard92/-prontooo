import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LIBRO, PER_ID } from './libro'
import {
  type ComponenteAbbinabile,
  abbina,
  occorrente,
  passiDi,
  scrivi,
} from './modello'
import { proposte } from './scelta'

function comp(
  nome: string,
  ruolo: string,
  gruppo: string,
  quantita: number,
  etichette: string[] = [],
): ComponenteAbbinabile {
  return { ruolo, alimentoId: 1, nome, quantita, unita: 'g', gruppo, etichette }
}

const PRANZO = [
  comp('Pasta di semola', 'base', 'cereale', 80, ['glutine']),
  comp('Zucchine', 'verdura', 'verdura', 200),
  comp('Olio extravergine', 'grasso', 'grasso', 10),
]

describe('il ricettario', () => {
  it('non ha id ripetuti', () => {
    assert.equal(PER_ID.size, LIBRO.length)
  })

  it('richiama nei passi solo posti che esistono', () => {
    for (const ricetta of LIBRO) {
      const chiavi = new Set(ricetta.posti.map((p) => p.chiave))

      for (const passo of ricetta.passi) {
        for (const [, chiave] of passo.matchAll(/\{(\w+)\}/g)) {
          assert.ok(chiavi.has(chiave!), `${ricetta.id}: {${chiave}} non e' un posto`)
        }
      }
    }
  })

  it('nomina ogni posto almeno una volta nei passi', () => {
    for (const ricetta of LIBRO) {
      const testo = ricetta.passi.join(' ')

      for (const posto of ricetta.posti) {
        assert.ok(testo.includes(`{${posto.chiave}}`), `${ricetta.id}: ${posto.chiave} non compare`)
      }
    }
  })

  it('ha almeno un posto obbligatorio per ricetta', () => {
    for (const ricetta of LIBRO) {
      assert.ok(ricetta.posti.some((p) => !p.facoltativo), `${ricetta.id}: tutti facoltativi`)
    }
  })

  it('copre tutte le fasce', () => {
    for (const fascia of ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena']) {
      const quante = LIBRO.filter((r) => r.fasce.includes(fascia as never)).length

      assert.ok(quante >= 2, `${fascia}: solo ${quante} ricette`)
    }
  })
})

describe('abbina', () => {
  it('riempie i posti coi componenti giusti', () => {
    const pasta = PER_ID.get('pasta-verdure-saltate')!
    const esito = abbina(pasta, PRANZO)

    assert.ok(esito)
    assert.equal(esito.assegnati.get('pasta')?.nome, 'Pasta di semola')
    assert.equal(esito.assegnati.get('verdura')?.nome, 'Zucchine')
    assert.equal(esito.assegnati.get('grasso')?.nome, 'Olio extravergine')
  })

  it('dice "calza" quando usa tutto e non avanza niente', () => {
    const esito = abbina(PER_ID.get('pasta-verdure-saltate')!, PRANZO)

    assert.equal(esito?.livello, 'calza')
    assert.deepEqual(esito?.avanzati, [])
  })

  it('dice "adattabile" quando manca un posto obbligatorio', () => {
    const senzaPesce = [comp('Patate', 'base', 'tubero', 200), comp('Olio', 'grasso', 'grasso', 10)]
    const esito = abbina(PER_ID.get('pesce-forno')!, senzaPesce)

    assert.equal(esito?.livello, 'adattabile')
    assert.deepEqual(
      esito?.mancanti.map((p) => p.chiave),
      ['pesce'],
    )
  })

  it('scarta la ricetta quando i posti vuoti sono due', () => {
    const solaVerdura = [comp('Insalata', 'verdura', 'verdura', 150)]

    assert.equal(abbina(PER_ID.get('uova-pomodoro')!, solaVerdura), null)
  })

  it('non mette un alimento escluso in un posto che lo rifiuta', () => {
    const duecarni = [
      comp('Manzo', 'proteina', 'carne', 150, ['carne_rossa']),
      comp('Petto di pollo', 'proteina', 'carne', 150),
      comp('Zucchine', 'verdura', 'verdura', 200),
    ]
    const esito = abbina(PER_ID.get('pollo-padella-limone')!, duecarni)

    // Il posto rifiuta la carne rossa: prende il pollo, e il manzo resta fuori.
    assert.equal(esito?.assegnati.get('pollo')?.nome, 'Petto di pollo')
    assert.deepEqual(esito?.avanzati.map((c) => c.nome), ['Manzo'])
  })

  it('non mette la carne in un posto che chiede il pesce', () => {
    const esito = abbina(PER_ID.get('pesce-forno')!, [
      comp('Fettina di manzo', 'proteina', 'carne', 150, ['carne_rossa']),
      comp('Patate', 'base', 'tubero', 200),
    ])

    assert.equal(esito, null)
  })

  it('scarta la ricetta quando manca un posto e intanto avanza roba', () => {
    // "Ti manca il pesce" mentre hai in mano una bistecca non e' un
    // adattamento: e' un'altra ricetta che dovresti cercare.
    const bistecca = [
      comp('Fettina di manzo', 'proteina', 'carne', 150, ['carne_rossa']),
      comp('Patate', 'base', 'tubero', 200),
    ]

    assert.equal(abbina(PER_ID.get('pesce-forno')!, bistecca), null)
  })

  it('non assegna due posti allo stesso componente', () => {
    const esito = abbina(PER_ID.get('cereale-verdure-proteina')!, [
      comp('Farro', 'base', 'cereale', 80),
      comp('Ceci', 'proteina', 'legume', 100),
      comp('Broccoli', 'verdura', 'verdura', 200),
    ])!

    const nomi = [...esito.assegnati.values()].map((c) => c.nome)

    assert.equal(new Set(nomi).size, nomi.length)
  })

  it('lascia fuori le voci "a piacere", che hanno quantita zero', () => {
    const esito = abbina(PER_ID.get('pasta-verdure-saltate')!, [
      ...PRANZO,
      comp('Verdure a piacere', 'verdura', 'verdura', 0),
    ])!

    assert.deepEqual(esito.avanzati, [])
  })

  it('segna come avanzato quello che la ricetta non usa', () => {
    const esito = abbina(PER_ID.get('pasta-pomodoro')!, [
      comp('Pasta', 'base', 'cereale', 80),
      comp('Pomodori', 'verdura', 'verdura', 200),
      comp('Petto di pollo', 'proteina', 'carne', 150),
      comp('Mela', 'frutta', 'frutta', 150),
    ])!

    assert.deepEqual(esito.avanzati.map((c) => c.nome).sort(), ['Mela', 'Petto di pollo'])
  })
})

describe('il testo della ricetta', () => {
  it('scrive i grammi del pasto dentro i passi', () => {
    const esito = abbina(PER_ID.get('pasta-verdure-saltate')!, PRANZO)!
    const passi = passiDi(esito).join(' ')

    assert.match(passi, /80 g di pasta di semola/)
    assert.match(passi, /200 g di zucchine/)
    assert.doesNotMatch(passi, /\{/)
  })

  it('dice quale posto e da aggiungere quando manca', () => {
    const esito = abbina(PER_ID.get('pesce-forno')!, [
      comp('Patate', 'base', 'tubero', 200),
      comp('Olio', 'grasso', 'grasso', 10),
    ])!

    assert.match(passiDi(esito).join(' '), /pesce \(da aggiungere\)/)
  })

  it('elenca l occorrente coi grammi e i liberi q.b.', () => {
    const esito = abbina(PER_ID.get('pasta-verdure-saltate')!, PRANZO)!
    const elenco = occorrente(esito)

    assert.ok(elenco.includes('80 g di pasta di semola'))
    assert.ok(elenco.includes('aglio q.b.'))
  })

  it('scrive le voci a piacere senza quantita', () => {
    assert.equal(scrivi(comp('Verdure crude', 'verdura', 'verdura', 0)), 'verdure crude')
  })
})

describe('proposte', () => {
  it('propone solo ricette della fascia', () => {
    for (const p of proposte('colazione', [
      comp('Yogurt greco', 'latticino', 'latticino', 150),
      comp('Fiocchi d avena', 'cereale_colazione', 'cereale', 40),
    ])) {
      assert.ok(p.ricetta.fasce.includes('colazione'))
    }
  })

  it('mette per prime quelle che calzano', () => {
    const elenco = proposte('pranzo', PRANZO)

    assert.ok(elenco.length > 0)
    assert.equal(elenco[0]!.livello, 'calza')
  })

  it('non propone la fettina coi broccoli a colazione ne a merenda', () => {
    // E' il caso che ha fatto nascere la regola: una carne e una verdura sono
    // un pranzo o una cena, e in nessun altro posto.
    const fettinaEBroccoli = [
      comp('Fettina di vitello', 'proteina', 'carne', 150, ['carne_rossa']),
      comp('Broccoli', 'verdura', 'verdura', 200),
      comp('Olio extravergine', 'grasso', 'grasso', 10),
    ]

    for (const fascia of ['colazione', 'spuntino', 'merenda']) {
      assert.deepEqual(proposte(fascia, fettinaEBroccoli), [], `${fascia}: qualcosa e passato`)
    }

    assert.ok(proposte('cena', fettinaEBroccoli).length > 0)
  })

  it('nessuna ricetta del libro sta insieme a colazione e a cena', () => {
    // Una ricetta in tutte le fasce vorrebbe dire che le fasce non filtrano
    // niente. Il pane e' l'unica eccezione onesta: pane e spalmabile vale
    // anche a merenda, ma non arriva a cena.
    for (const ricetta of LIBRO) {
      const daPasto = ricetta.fasce.includes('pranzo') || ricetta.fasce.includes('cena')
      const daColazione = ricetta.fasce.includes('colazione')

      assert.ok(
        !(daPasto && daColazione) || ricetta.posti.some((p) => p.gruppi.includes('uova')),
        `${ricetta.id} sta sia a colazione sia a tavola`,
      )
    }
  })

  it('non propone niente per una fascia che non esiste', () => {
    assert.deepEqual(proposte('aperitivo', PRANZO), [])
  })

  it('trova sempre qualcosa per un pasto composto normale', () => {
    const casi: [string, ComponenteAbbinabile[]][] = [
      [
        'colazione',
        [
          comp('Latte', 'latticino', 'latticino', 200),
          comp('Fette biscottate', 'cereale_colazione', 'cereale', 40),
          comp('Marmellata', 'spalmabile', 'dolce', 20),
        ],
      ],
      ['spuntino', [comp('Mela', 'frutta', 'frutta', 150), comp('Mandorle', 'snack', 'frutta_secca', 20)]],
      [
        'pranzo',
        [
          comp('Riso', 'base', 'cereale', 80),
          comp('Merluzzo', 'proteina', 'pesce', 180),
          comp('Spinaci', 'verdura', 'verdura', 200),
          comp('Olio', 'grasso', 'grasso', 10),
        ],
      ],
      [
        'cena',
        [
          comp('Uova', 'proteina', 'uova', 120),
          comp('Pane integrale', 'base', 'pane', 60),
          comp('Zucchine', 'verdura', 'verdura', 200),
        ],
      ],
    ]

    for (const [fascia, componenti] of casi) {
      assert.ok(proposte(fascia, componenti).length > 0, `${fascia}: nessuna proposta`)
    }
  })
})

describe('quando la ricetta non e’ di questo pasto', () => {
  it('scarta chi lascia fuori piu’ di quello che usa', () => {
    // Un pasto di quattro componenti di cui la ricetta ne prende uno: e' il
    // caso che ha dato "Ricotta e miele" sopra una colazione col salmone
    // affumicato dentro. Il titolo non e' di questo piatto.
    const esito = abbina(PER_ID.get('ricotta-miele')!, [
      comp('Ricotta vaccina', 'latticino', 'latticino', 150),
      comp('Petto di pollo', 'proteina', 'carne', 150),
      comp('Broccoli', 'verdura', 'verdura', 200),
      comp('Olio extravergine', 'grasso', 'grasso', 10),
    ])

    assert.equal(esito, null)
  })

  it('tiene il primo con il secondo accanto, che e’ un pranzo normale', () => {
    const esito = abbina(PER_ID.get('pasta-pomodoro')!, [
      comp('Pasta', 'base', 'cereale', 80),
      comp('Pomodori', 'verdura', 'verdura', 200),
      comp('Petto di pollo', 'proteina', 'carne', 150),
      comp('Mela', 'frutta', 'frutta', 150),
    ])

    assert.notEqual(esito, null)
  })
})
