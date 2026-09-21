import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { POSTI_MASSIMI, type IngredienteRiconosciuto, converti, nominatoNel } from './posti'

function ing(
  nome: string,
  gruppo: string | null,
  ruolo: string | null,
  grammi: number | null,
  etichette: string[] = [],
  tipo: IngredienteRiconosciuto['tipo'] = 'alimento',
): IngredienteRiconosciuto {
  return { alimentoId: 1, nome, gruppo, ruolo, grammi, etichette, tipo }
}

/** Una pasta al pomodoro come la scrive un sito vero. */
const PASTA_POMODORO = [
  ing('Pasta di semola', 'cereale', 'base', 320, ['glutine']),
  ing('Passata di pomodoro', 'verdura', 'verdura', 500),
  ing('Olio extravergine di oliva', 'grasso', 'grasso', 20),
  ing('Basilico', null, null, null, [], 'libero'),
  ing('Sale', null, null, null, [], 'libero'),
]

describe('convertire una ricetta del catalogo', () => {
  it('trasforma gli ingredienti in posti', () => {
    const esito = converti(PASTA_POMODORO)

    assert.deepEqual(
      esito.posti.map((p) => p.ruolo),
      ['verdura', 'base', 'grasso'],
    )
  })

  it('tiene stretto il gruppo di ogni posto', () => {
    // Una ricetta di pesce non deve accettare il manzo solo perche' copre lo
    // stesso ruolo: e' "pesce al forno" fatto con la bistecca.
    const esito = converti([
      ing('Merluzzo', 'pesce', 'proteina', 150),
      ing('Patate', 'tubero', 'base', 200),
      ing('Olio extravergine di oliva', 'grasso', 'grasso', 10),
    ])

    const proteina = esito.posti.find((p) => p.ruolo === 'proteina')

    assert.deepEqual(proteina?.gruppi, ['pesce'])
  })

  it('segna il condimento come facoltativo', () => {
    const esito = converti(PASTA_POMODORO)

    assert.equal(esito.posti.find((p) => p.ruolo === 'grasso')?.facoltativo, true)
    assert.equal(esito.posti.find((p) => p.ruolo === 'base')?.facoltativo, undefined)
  })

  it('a parita’ di ruolo tiene quello che pesa di piu’', () => {
    const esito = converti([
      ing('Zucchine', 'verdura', 'verdura', 100),
      ing('Melanzane', 'verdura', 'verdura', 400),
      ing('Pasta di semola', 'cereale', 'base', 320),
      ing('Olio extravergine di oliva', 'grasso', 'grasso', 10),
    ])

    assert.equal(esito.posti.filter((p) => p.ruolo === 'verdura').length, 1)
    assert.deepEqual(esito.posti.find((p) => p.ruolo === 'verdura')?.gruppi, ['verdura'])
  })

  it('non supera mai i posti che un pasto ha', () => {
    // Una ricetta con sei posti non potrebbe calzare un piatto che ne ha
    // quattro, e resterebbe per sempre "ti manca qualcosa".
    const esito = converti([
      ing('Pasta di semola', 'cereale', 'base', 320),
      ing('Petto di pollo', 'carne', 'proteina', 300),
      ing('Zucchine', 'verdura', 'verdura', 250),
      ing('Olio extravergine di oliva', 'grasso', 'grasso', 20),
      ing('Mandorle', 'frutta_secca', 'semi', 15),
      ing('Mela', 'frutta', 'frutta', 150),
    ])

    assert.ok(esito.posti.length <= POSTI_MASSIMI)
  })

  it('scarta quello che e’ un alimento con un titolo sopra', () => {
    // "Mela" non e' una ricetta per la merenda.
    const esito = converti([ing('Mela', 'frutta', 'frutta', 150)])

    assert.deepEqual(esito.posti, [])
  })

  it('non conta il condimento fra i posti che fanno una ricetta', () => {
    const esito = converti([
      ing('Pasta di semola', 'cereale', 'base', 320),
      ing('Olio extravergine di oliva', 'grasso', 'grasso', 20),
    ])

    assert.deepEqual(esito.posti, [], 'pasta in bianco non e’ una ricetta a posti')
  })
})

describe('le etichette di una ricetta convertita', () => {
  it('mette insieme quelle di tutti gli ingredienti', () => {
    const esito = converti([
      ing('Pasta di semola', 'cereale', 'base', 320, ['glutine']),
      ing('Mozzarella', 'latticino', 'proteina', 125, ['lattosio', 'proteico']),
      ing('Olio extravergine di oliva', 'grasso', 'grasso', 20),
    ])

    assert.deepEqual(esito.etichette, ['glutine', 'lattosio', 'proteico'])
  })

  it('sono attendibili solo se ho capito tutte le righe', () => {
    assert.equal(converti(PASTA_POMODORO).affidabile, true)

    const conMistero = [...PASTA_POMODORO, ing('Salsa segreta', null, null, null, [], 'sconosciuto')]

    assert.equal(
      converti(conMistero).affidabile,
      false,
      'una riga non capita toglie la garanzia a tutta la ricetta',
    )
  })

  it('tiene da parte quello che si scrive e non si pesa', () => {
    assert.deepEqual(converti(PASTA_POMODORO).liberi, ['Basilico', 'Sale'])
  })
})

describe('il posto si ricorda con cosa e’ nato', () => {
  it('tiene l’alimento, non solo il gruppo', () => {
    const esito = converti(
      [
        ing('Baccala', 'pesce', 'proteina', 400),
        ing('Patate', 'tubero', 'base', 500),
        ing('Zucchine', 'verdura', 'verdura', 300),
      ],
      'Baccalà alle verdure',
    )

    const proteina = esito.posti.find((p) => p.ruolo === 'proteina')

    assert.equal(proteina?.nome, 'Baccala')
    // Il titolo lo nomina: quel posto vuole quello e nessun altro pesce.
    assert.equal(proteina?.nelTitolo, true)
  })

  it('non accende la promessa dove il titolo non nomina niente', () => {
    const esito = converti(
      [
        ing('Baccala', 'pesce', 'proteina', 400),
        ing('Patate', 'tubero', 'base', 500),
      ],
      'Zuppa del pescatore',
    )

    assert.ok(esito.posti.every((p) => p.nelTitolo !== true))
  })

  it('senza titolo si comporta come prima', () => {
    // Le ricette lette prima di questa regola non avevano il titolo qui
    // dentro: devono continuare a funzionare, larghe com'erano.
    const esito = converti([
      ing('Baccala', 'pesce', 'proteina', 400),
      ing('Patate', 'tubero', 'base', 500),
    ])

    assert.ok(esito.posti.every((p) => p.nelTitolo !== true))
  })
})

describe('quando un nome e’ scritto nel titolo', () => {
  it('serve tutto il nome, non una parola sola', () => {
    // Con una parola sola "Pasta e fagioli" pretenderebbe la Pasta di semola
    // esatta, e non si proporrebbe quasi mai.
    assert.equal(nominatoNel('Pasta e fagioli', 'Pasta di semola'), false)
    assert.equal(nominatoNel('Pasta e fagioli', 'Fagioli borlotti'), false)
  })

  it('e scatta dove il titolo e’ davvero specifico', () => {
    assert.equal(nominatoNel('Baccalà alle verdure', 'Baccala'), true)
    assert.equal(nominatoNel('Petto di pollo alla griglia', 'Petto di pollo'), true)
    assert.equal(nominatoNel('Gamberi in tempura', 'Gamberi'), true)
  })

  it('non si fa fermare da accenti e maiuscole', () => {
    assert.equal(nominatoNel('BACCALÀ al forno', 'Baccala'), true)
  })

  it('e non dice di sì quando il nome non c’e’', () => {
    assert.equal(nominatoNel('Baccalà alle verdure', 'Calamari'), false)
    assert.equal(nominatoNel('', 'Baccala'), false)
    assert.equal(nominatoNel('Baccalà alle verdure', ''), false)
  })
})
