import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type Candidata, LIMITI, distanza, numeroDiRicetta, scalaRicetta } from './daRicetta'
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

describe('dove ci vanno le ricette del catalogo', () => {
  it('solo a pranzo e a cena', () => {
    // Il caso vero: costine di maiale glassate cinesi proposte per merenda,
    // con un'ora e dieci di preparazione. Il difetto non era la ricetta, era
    // averla cercata li'.
    assert.ok(LIMITI.pranzo)
    assert.ok(LIMITI.cena)

    for (const fascia of ['colazione', 'spuntino', 'merenda']) {
      assert.equal(LIMITI[fascia], undefined, `${fascia} pesca dal catalogo`)
    }
  })

  it('e con un tetto di tempo che sta in una sera', () => {
    for (const [fascia, limite] of Object.entries(LIMITI)) {
      assert.ok(limite.minuti > 0 && limite.minuti <= 60, `${fascia}: ${limite.minuti} minuti`)
      assert.ok(limite.ruoli.length > 0, `${fascia} non accetta nessun tipo di piatto`)
    }
  })

  it('accetta solo piatti che reggono un pasto', () => {
    // Antipasti, contorni e dolci non fanno un pranzo da soli: se entrassero
    // qui, la giornata proporrebbe un contorno come cena.
    for (const limite of Object.values(LIMITI)) {
      for (const ruolo of limite.ruoli) {
        assert.ok(
          ['primo', 'secondo', 'piatto_unico'].includes(ruolo),
          `${ruolo} non regge un pasto`,
        )
      }
    }
  })
})

describe('scegliere la ricetta anche sui macro', () => {
  const ricetta = (nome: string, kcal: number, proteine: number, grassi: number): Candidata => ({
    id: 1,
    titolo: nome,
    fasce: ['pranzo'],
    etichette: [],
    ruolo: 'primo',
    minuti: 30,
    kcal: String(kcal),
    proteine: String(proteine),
    grassi: String(grassi),
  })

  // Il caso vero: 643 kcal con dentro 30 g di olio. Le calorie tornavano,
  // il piatto era il 53% grassi e il 10% proteine.
  const PESTO = ricetta('Pasta col pesto', 643, 16, 38)
  const TONNO = ricetta('Pasta col tonno', 640, 35, 15)

  // Quello che fabbisogno.ts calcola: grassi al 27%, proteine dal peso.
  const VOLUTA = { proteine: 0.3, grassi: 0.27 }

  it('mette davanti il piatto col profilo giusto', () => {
    assert.ok(
      distanza(TONNO, VOLUTA) < distanza(PESTO, VOLUTA),
      'il piatto con meta’ calorie di olio non deve vincere sulle stesse kcal',
    )
  })

  it('i grassi pesano il doppio', () => {
    // Un piatto con poche proteine puo' restare un pranzo normale; uno in cui
    // meta' delle calorie e' olio e' sbagliato per chiunque.
    const scarsoDiProteine = ricetta('Pasta al pomodoro', 600, 12, 18)
    const carico = ricetta('Pasta molto condita', 600, 20, 40)

    assert.ok(distanza(carico, VOLUTA) > distanza(scarsoDiProteine, VOLUTA))
  })

  it('chi non ha i numeri finisce in fondo, non fuori', () => {
    // E' una ricetta che non sappiamo giudicare, non una che sappiamo
    // cattiva: resta in coda e viene proposta se non c'e' di meglio.
    const senzaNumeri = { ...PESTO, kcal: null, proteine: null, grassi: null }

    assert.equal(distanza(senzaNumeri, VOLUTA), Number.POSITIVE_INFINITY)
    assert.ok(distanza(PESTO, VOLUTA) < distanza(senzaNumeri, VOLUTA))
  })

  it('una ricetta uguale al profilo ha distanza quasi zero', () => {
    // 600 kcal: 45 g di proteine fanno il 30%, 18 g di grassi fanno il 27%.
    const giusta = ricetta('Il pranzo che vorresti', 600, 45, 18)

    assert.ok(distanza(giusta, VOLUTA) < 0.02)
  })
})
