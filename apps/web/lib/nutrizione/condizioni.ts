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
  {
    id: 'colon_irritabile',
    nome: 'Colon irritabile',
    spiega: 'Fa uscire di rado i fermentabili che piu\u2019 spesso danno gonfiore.',
    regole: [
      {
        id: 'fodmap_verdure',
        verso: 'di_rado',
        alimenti: ['Cipolla', 'Carciofi', 'Cavolfiore', 'Broccoli'],
        cosaFa: 'Cipolla, carciofi e crucifere escono di rado.',
        quantoSiSa:
          'Sono fra i FODMAP piu\u2019 fermentabili, e la dieta a basso contenuto di FODMAP e\u2019 oggi l\u2019intervento alimentare con piu\u2019 prove nel colon irritabile.',
      },
      {
        id: 'fodmap_legumi',
        verso: 'di_rado',
        alimenti: ['Ceci lessati', 'Fagioli borlotti', 'Fagioli cannellini', 'Lenticchie lessate'],
        cosaFa: 'I legumi interi escono di rado.',
        quantoSiSa:
          'Sono galatto-oligosaccaridi, e sono una delle cause piu\u2019 comuni di gonfiore. Attenzione pero\u2019: i legumi portano fibra e ferro, e toglierli a lungo lascia buchi veri. Se li digerisci, spegni questa regola.',
      },
      {
        id: 'fodmap_frutta',
        verso: 'di_rado',
        alimenti: ['Mela', 'Pera', 'Anguria'],
        cosaFa: 'Mela, pera e anguria escono di rado.',
        quantoSiSa:
          'Sono le tre piu\u2019 ricche di fruttosio e polioli. Le altre frutte restano dove sono: qui non si toglie la frutta, si cambia quale.',
      },
    ],
    esclusioniSuggerite: [
      {
        etichetta: 'lattosio',
        perche:
          'Il lattosio e\u2019 un FODMAP, e in chi ha il colon irritabile da\u2019 fastidio spesso. Prima di toglierlo del tutto guarda la via di mezzo qui sopra: la versione senza lattosio esiste per quasi tutto.',
      },
    ],
  },
  {
    id: 'gotta',
    nome: 'Gotta o acido urico alto',
    spiega: 'Abbassa la frequenza di quello che fa salire l\u2019uricemia.',
    regole: [
      {
        id: 'purine_pesce',
        verso: 'di_rado',
        alimenti: ['Alici', 'Sardine', 'Cozze', 'Gamberi', 'Sgombro al naturale'],
        cosaFa: 'Pesce azzurro piccolo, molluschi e crostacei escono di rado.',
        quantoSiSa:
          'Sono i piu\u2019 concentrati in purine, e negli studi il pesce alza il rischio di attacco di circa la meta\u2019. Il pesce non sparisce: restano merluzzo, tonno e salmone.',
      },
      {
        id: 'purine_carne',
        verso: 'di_rado',
        alimenti: ['Fettina di manzo', 'Macinato di manzo', 'Spezzatino di manzo', 'Hamburger di manzo'],
        cosaFa: 'La carne rossa esce di rado.',
        quantoSiSa:
          'E\u2019 la raccomandazione piu\u2019 costante di tutte le linee guida sulla gotta, insieme alle frattaglie - che qui dentro non ci sono.',
      },
      {
        id: 'fruttosio',
        verso: 'di_rado',
        alimenti: ['Gelato', 'Granita siciliana', 'Muffin', 'Biscotti secchi'],
        cosaFa: 'I dolci industriali e le bibite escono di rado.',
        quantoSiSa:
          'Il fruttosio e\u2019 l\u2019unico zucchero che alza direttamente l\u2019acido urico, e nelle meta-analisi le bevande zuccherate aumentano il rischio di gotta di circa un quinto. La frutta intera non c\u2019entra: li\u2019 il fruttosio arriva con fibra e acqua.',
      },
      {
        id: 'latticini_magri',
        verso: 'piu_spesso',
        alimenti: ['Yogurt greco 0%', 'Ciliegie', 'Orzo perlato'],
        cosaFa: 'Latticini magri, ciliegie e cereali integrali escono piu\u2019 spesso.',
        quantoSiSa:
          'I latticini magri sono associati a meno gotta. Sulle ciliegie qualche studio c\u2019e\u2019 ma la certezza e\u2019 bassa: le metto perche\u2019 non costano niente, non perche\u2019 siano una cura.',
      },
    ],
  },
  {
    id: 'ferro_basso',
    nome: 'Ferro basso o anemia',
    spiega: 'Mette insieme il ferro e quello che lo fa assorbire.',
    regole: [
      {
        id: 'ferro',
        verso: 'piu_spesso',
        alimenti: ['Fettina di manzo', 'Lenticchie lessate', 'Spinaci', 'Sgombro al naturale', 'Uova'],
        cosaFa: 'Carne rossa, legumi, spinaci e uova escono piu\u2019 spesso.',
        quantoSiSa:
          'Il ferro della carne si assorbe molto meglio di quello dei vegetali, e questo e\u2019 assodato. Un piano non cura un\u2019anemia: se l\u2019emoglobina e\u2019 bassa davvero serve il medico, non la spesa.',
      },
      {
        id: 'vitamina_c',
        verso: 'piu_spesso',
        alimenti: ['Arance', 'Limone', 'Kiwi', 'Peperoni', 'Pomodori'],
        cosaFa: 'Agrumi, kiwi e peperoni escono piu\u2019 spesso.',
        quantoSiSa:
          'Questa e\u2019 la regola con la resa piu\u2019 alta di tutte: 100 mg di vitamina C nello stesso pasto moltiplicano per quattro il ferro assorbito dai vegetali. Il limone sui legumi non e\u2019 folklore.',
      },
      {
        id: 'tannini',
        verso: 'di_rado',
        alimenti: ['T\u00e8 verde'],
        cosaFa: 'Il t\u00e8 esce di rado.',
        quantoSiSa:
          'I tannini del t\u00e8 possono tagliare l\u2019assorbimento del ferro fino al 90%, il caff\u00e8 fino al 60%. Conta pero\u2019 **quando**: lontano dai pasti il problema non si pone, e l\u2019app la distanza dalla tazzina non la sa. Qui puo\u2019 solo diradare.',
      },
    ],
  },
  {
    id: 'fegato_grasso',
    nome: 'Fegato grasso',
    spiega: 'Sposta il piano verso il mediterraneo e taglia gli zuccheri aggiunti.',
    regole: [
      {
        id: 'zuccheri_aggiunti',
        verso: 'di_rado',
        alimenti: ['Gelato', 'Granita siciliana', 'Cornetto', 'Brioche col tuppo', 'Muffin', 'Biscotti secchi'],
        cosaFa: 'Dolci da bar e industriali escono di rado.',
        quantoSiSa:
          'Sugli zuccheri aggiunti e sul fruttosio raffinato le prove sono buone: aggiungere calorie da bevande zuccherate aumenta il grasso nel fegato in modo misurabile. La frutta intera no, anzi: li\u2019 fibra e polifenoli sembrano proteggere.',
      },
      {
        id: 'mediterraneo',
        verso: 'piu_spesso',
        alimenti: ['Olio extravergine di oliva', 'Merluzzo', 'Salmone fresco', 'Lenticchie lessate', 'Broccoli', 'Noci'],
        cosaFa: 'Olio d\u2019oliva, pesce, legumi, verdura e frutta secca escono piu\u2019 spesso.',
        quantoSiSa:
          'La dieta mediterranea e\u2019 quella consigliata per la steatosi, ed e\u2019 stata provata su due anni con miglioramenti veri. Va detto pero\u2019 che la leva piu\u2019 forte resta il peso: perdere il 5-10% fa piu\u2019 di qualsiasi singolo alimento.',
      },
    ],
  },
  {
    id: 'stitichezza',
    nome: 'Stitichezza',
    spiega: 'Fa uscire piu\u2019 spesso quello che nelle prove funziona davvero.',
    regole: [
      {
        id: 'kiwi',
        verso: 'piu_spesso',
        alimenti: ['Kiwi', 'Prugne'],
        cosaFa: 'Kiwi e prugne escono piu\u2019 spesso.',
        quantoSiSa:
          'Il kiwi e\u2019 la cosa meglio dimostrata che si possa fare a tavola: nelle linee guida dietetiche britanniche del 2025 regge il confronto con lo psillio sulla consistenza, ed e\u2019 quello che la gente smette di prendere meno spesso - il 7% contro il 38% dello psillio.',
      },
      {
        id: 'fibra',
        verso: 'piu_spesso',
        alimenti: ['Pane di segale', 'Orzo perlato', 'Ceci lessati', 'Fagioli borlotti', 'Carciofi'],
        cosaFa: 'Segale, cereali integrali e legumi escono piu\u2019 spesso.',
        quantoSiSa:
          'Il pane di segale e\u2019 fra i pochi alimenti singoli che le linee guida nominano per nome. Resta vero che senza bere di piu\u2019 la fibra da sola puo\u2019 peggiorare le cose, e l\u2019acqua l\u2019app non te la puo\u2019 versare.',
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
