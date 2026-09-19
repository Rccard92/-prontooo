import type { Etichetta } from '@prontooo/db/alimenti'

/**
 * Le condizioni di salute che spostano il piano.
 *
 * Questa non e' una diagnosi e non e' una cura: e' un modo di scrivere una
 * volta sola quello che gia' sai di te, cosi' l'app non te lo fa ripetere
 * ogni settimana. Chi decide resta il medico; qui si traduce quella decisione
 * in "questo alimento esce di rado, quest'altro piu' spesso".
 *
 * Tre regole che mi sono dato scrivendole, e che si vedono nel risultato:
 *
 * 1. **Niente esclusioni rigide per una patologia.** Un'esclusione rigida e'
 *    per un'allergia o una scelta tua, e sta fra le esclusioni. Una condizione
 *    inclina, non vieta: ti lascia decidere e non ti nasconde meta' del
 *    vocabolario
 * 2. **Ogni regola dice perche'**, e dice anche quanto e' solida. Dove le
 *    prove sono discusse c'e' scritto che sono discusse, invece di far finta
 *    che sia tutto uguale
 * 3. **Si spegne una regola alla volta.** Se una non ti convince la togli,
 *    senza rinunciare al resto
 */
export type Regola = {
  id: string
  /** Cosa fa: alimenti che escono di rado, o che escono piu' spesso. */
  verso: 'di_rado' | 'piu_spesso'
  /** Gli alimenti toccati, per nome. */
  alimenti: string[]
  /** Cosa cambia, detto a chi legge. */
  cosaFa: string
  /** Quanto e' solido il motivo. Si mostra insieme alla regola. */
  quantoSiSa: string
}

export type Condizione = {
  id: string
  nome: string
  /** Una riga che spiega a cosa serve accenderla. */
  spiega: string
  regole: Regola[]
  /** Esclusioni che l'app **propone** di accendere, ma non accende da sola. */
  esclusioniSuggerite?: { etichetta: Etichetta; perche: string }[]
}

export const CONDIZIONI: Condizione[] = [
  {
    id: 'hashimoto',
    nome: 'Tiroidite di Hashimoto',
    spiega: 'Sposta il piano su quello che di solito si consiglia con la tiroide autoimmune.',
    regole: [
      {
        id: 'soia',
        verso: 'di_rado',
        alimenti: ['Tofu', 'Tempeh', 'Edamame', 'Bevanda di soia', 'Germogli di soia'],
        cosaFa: 'La soia esce di rado, non sparisce.',
        quantoSiSa:
          'Questo e\' il punto piu\' solido: la soia puo\' ridurre l\'assorbimento della levotiroxina. Conta soprattutto la distanza dalla pastiglia, quindi se la mangi lontano dalla terapia il problema si ridimensiona.',
      },
      {
        id: 'selenio',
        verso: 'piu_spesso',
        alimenti: ['Tonno al naturale', 'Merluzzo', 'Sardine', 'Uova', 'Noci', 'Semi di girasole'],
        cosaFa: 'Pesce, uova e frutta secca escono piu\' spesso.',
        quantoSiSa:
          'Selenio e zinco arrivano di qui, e sul selenio nella tiroidite autoimmune qualche studio c\'e\'. Non e\' una cura: e\' mangiare un po\' piu\' spesso cose che fanno comunque bene.',
      },
    ],
    esclusioniSuggerite: [
      {
        etichetta: 'glutine',
        perche:
          'Molti con Hashimoto tolgono il glutine e dicono di stare meglio, e la celiachia e\' davvero piu\' frequente in chi ha una tiroidite autoimmune. Ma fuori dalla celiachia le prove sono discusse: non lo accendo io, lo accendi tu se lo hai deciso col medico.',
      },
    ],
  },
  {
    id: 'colesterolo',
    nome: 'Colesterolo alto',
    spiega: 'Meno grassi saturi e piu\' fibra solubile, che e\' la parte su cui si puo\' agire mangiando.',
    regole: [
      {
        id: 'saturi',
        verso: 'di_rado',
        alimenti: ['Burro', 'Salsiccia', 'Mortadella', 'Speck', 'Caciocavallo', 'Pecorino', 'Gorgonzola'],
        cosaFa: 'Burro, salumi grassi e formaggi stagionati escono di rado.',
        quantoSiSa: 'E\' la raccomandazione piu\' condivisa che ci sia sul tema.',
      },
      {
        id: 'fibra',
        verso: 'piu_spesso',
        alimenti: ["Fiocchi d'avena", 'Orzo perlato', 'Ceci lessati', 'Lenticchie lessate', 'Fagioli cannellini'],
        cosaFa: 'Avena, orzo e legumi escono piu\' spesso.',
        quantoSiSa: 'La fibra solubile di avena e legumi ha effetto misurato sul colesterolo.',
      },
    ],
  },
  {
    id: 'pressione',
    nome: 'Pressione alta',
    spiega: 'Meno sale nascosto: nei salumi e nei formaggi stagionati ce n\'e\' piu\' che nella saliera.',
    regole: [
      {
        id: 'sodio',
        verso: 'di_rado',
        alimenti: ['Prosciutto crudo', 'Speck', 'Mortadella', 'Salsiccia', 'Pecorino', 'Grana Padano', 'Olive verdi', 'Olive nere'],
        cosaFa: 'Salumi, formaggi stagionati e olive escono di rado.',
        quantoSiSa: 'Il legame fra sodio e pressione e\' solido, e da li\' arriva gran parte del sale che mangiamo.',
      },
      {
        id: 'potassio',
        verso: 'piu_spesso',
        alimenti: ['Spinaci', 'Bietola', 'Banana', 'Patate', 'Fagioli cannellini'],
        cosaFa: 'Verdure a foglia, patate e legumi escono piu\' spesso.',
        quantoSiSa: 'Il potassio bilancia il sodio. Se prendi diuretici o hai problemi ai reni questa regola va spenta: parlane col medico.',
      },
    ],
  },
  {
    id: 'glicemia',
    nome: 'Glicemia da tenere d\'occhio',
    spiega: 'Meno zuccheri veloci, piu\' integrali e legumi.',
    regole: [
      {
        id: 'zuccheri',
        verso: 'di_rado',
        alimenti: ['Miele', 'Marmellata senza zuccheri aggiunti', 'Datteri', 'Uvetta', 'Granita siciliana', "Sciroppo d'acero", 'Gelato'],
        cosaFa: 'Dolcificanti, frutta secca zuccherina e dolci al cucchiaio escono di rado.',
        quantoSiSa: 'Alzano la glicemia in fretta: e\' il motivo piu\' diretto che ci sia.',
      },
      {
        id: 'integrali',
        verso: 'piu_spesso',
        alimenti: ['Pasta di semola integrale', 'Riso integrale', 'Orzo perlato', 'Farro perlato', 'Ceci lessati', 'Lenticchie lessate'],
        cosaFa: 'Integrali e legumi escono piu\' spesso.',
        quantoSiSa: 'Stessa quantita\' di carboidrati, salita piu\' lenta.',
      },
    ],
  },
  {
    id: 'reflusso',
    nome: 'Reflusso',
    spiega: 'Esce di rado quello che tipicamente lo peggiora.',
    regole: [
      {
        id: 'irritanti',
        verso: 'di_rado',
        alimenti: ['Passata di pomodoro', 'Sugo di pomodoro', 'Pomodori', 'Pomodorini', 'Cioccolato fondente 70%', 'Cornetto', 'Cotoletta di pollo', 'Cipolla'],
        cosaFa: 'Pomodoro, cioccolato, fritti e cipolla escono di rado.',
        quantoSiSa:
          'Qui si va molto a persona: sono i sospetti piu\' comuni, ma c\'e\' chi tollera benissimo il pomodoro e chi non regge il caffe\'. Se una di queste non ti da\' fastidio, spegni la regola.',
      },
    ],
  },
]

export function condizione(id: string): Condizione | null {
  return CONDIZIONI.find((c) => c.id === id) ?? null
}

/** L'id di una regola dentro il profilo: `hashimoto.soia`. */
export function chiaveRegola(condizione: string, regola: string): string {
  return `${condizione}.${regola}`
}

export type PesiCondizioni = { diRado: Set<string>; piuSpesso: Set<string> }

/**
 * Gli alimenti toccati dalle condizioni accese, meno le regole spente.
 *
 * Restituisce nomi e non id: chi chiama ha gia' il vocabolario in mano, e
 * cosi' questa funzione resta pura e si prova senza database.
 */
export function alimentiToccati(
  condizioniAttive: string[],
  regoleSpente: string[] = [],
): PesiCondizioni {
  const diRado = new Set<string>()
  const piuSpesso = new Set<string>()

  for (const id of condizioniAttive) {
    const trovata = condizione(id)

    if (!trovata) continue

    for (const regola of trovata.regole) {
      if (regoleSpente.includes(chiaveRegola(id, regola.id))) continue

      for (const nome of regola.alimenti) {
        if (regola.verso === 'di_rado') diRado.add(nome)
        else piuSpesso.add(nome)
      }
    }
  }

  // Una regola che dice "di rado" vince su una che dice "piu' spesso": fra
  // due condizioni in disaccordo si sceglie la prudente.
  for (const nome of diRado) piuSpesso.delete(nome)

  return { diRado, piuSpesso }
}

export type Suggerimento = { etichetta: Etichetta; perche: string; condizione: string }

/**
 * Le esclusioni che le condizioni accese **propongono**, senza accenderle.
 *
 * E' la differenza che tiene in piedi tutto il resto: una condizione inclina
 * le porzioni da sola, ma togliere un alimento per sempre lo decidi tu. Qui
 * esce solo il suggerimento, col motivo scritto accanto; chi lo legge spunta
 * o non spunta.
 */
export function esclusioniSuggeriteDa(condizioniAttive: string[]): Suggerimento[] {
  const fuori: Suggerimento[] = []

  for (const id of condizioniAttive) {
    const trovata = condizione(id)

    if (!trovata) continue

    for (const e of trovata.esclusioniSuggerite ?? []) {
      // Due condizioni possono proporre la stessa etichetta: il motivo lo
      // scrive la prima, ripeterlo sarebbe rumore.
      if (fuori.some((g) => g.etichetta === e.etichetta)) continue

      fuori.push({ etichetta: e.etichetta, perche: e.perche, condizione: trovata.nome })
    }
  }

  return fuori
}
