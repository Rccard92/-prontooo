/**
 * I piatti che si mangiano fuori, gia' pesati.
 *
 * Servono al caso "ero fuori, ho mangiato una pizza": senza chiave API non si
 * puo' stimare un pasto scritto a parole, ma un elenco di piatti comuni copre
 * quasi tutti i casi reali. I valori sono per la porzione indicata e sono
 * **stime**: una pizza al ristorante varia di 200 kcal fra un posto e l'altro.
 */
export type PiattoFuori = {
  nome: string
  gruppo: string
  porzione: number
  kcal: number
  proteine: number
  carboidrati: number
  grassi: number
}

export const PIATTI_FUORI: PiattoFuori[] = [
  // Pizzeria
  { nome: 'Pizza margherita', gruppo: 'Pizzeria', porzione: 300, kcal: 810, proteine: 33, carboidrati: 99, grassi: 30 },
  { nome: 'Pizza con verdure', gruppo: 'Pizzeria', porzione: 320, kcal: 830, proteine: 33, carboidrati: 100, grassi: 32 },
  { nome: 'Pizza con salumi', gruppo: 'Pizzeria', porzione: 330, kcal: 1000, proteine: 40, carboidrati: 100, grassi: 48 },
  { nome: 'Calzone', gruppo: 'Pizzeria', porzione: 300, kcal: 950, proteine: 38, carboidrati: 95, grassi: 45 },

  // Ristorante
  { nome: 'Primo al pomodoro', gruppo: 'Ristorante', porzione: 300, kcal: 480, proteine: 14, carboidrati: 80, grassi: 11 },
  { nome: 'Primo al ragù', gruppo: 'Ristorante', porzione: 320, kcal: 620, proteine: 25, carboidrati: 78, grassi: 22 },
  { nome: 'Primo alla carbonara', gruppo: 'Ristorante', porzione: 300, kcal: 780, proteine: 27, carboidrati: 75, grassi: 40 },
  { nome: 'Risotto', gruppo: 'Ristorante', porzione: 300, kcal: 560, proteine: 13, carboidrati: 82, grassi: 19 },
  { nome: 'Carne alla griglia con contorno', gruppo: 'Ristorante', porzione: 350, kcal: 480, proteine: 42, carboidrati: 12, grassi: 28 },
  { nome: 'Pesce al forno con contorno', gruppo: 'Ristorante', porzione: 350, kcal: 400, proteine: 40, carboidrati: 14, grassi: 20 },
  { nome: 'Frittura di pesce', gruppo: 'Ristorante', porzione: 250, kcal: 700, proteine: 30, carboidrati: 35, grassi: 48 },
  { nome: 'Insalatona con formaggio', gruppo: 'Ristorante', porzione: 350, kcal: 420, proteine: 20, carboidrati: 18, grassi: 30 },

  // Bar e fuori casa
  { nome: 'Panino con salumi', gruppo: 'Bar', porzione: 220, kcal: 560, proteine: 24, carboidrati: 60, grassi: 24 },
  { nome: 'Panino con verdure e formaggio', gruppo: 'Bar', porzione: 220, kcal: 480, proteine: 20, carboidrati: 58, grassi: 19 },
  { nome: 'Toast prosciutto e formaggio', gruppo: 'Bar', porzione: 150, kcal: 380, proteine: 20, carboidrati: 36, grassi: 17 },
  { nome: 'Arancino', gruppo: 'Bar', porzione: 200, kcal: 520, proteine: 14, carboidrati: 62, grassi: 23 },
  { nome: 'Cornetto e cappuccino', gruppo: 'Bar', porzione: 220, kcal: 380, proteine: 9, carboidrati: 45, grassi: 18 },
  { nome: 'Brioche col tuppo e granita', gruppo: 'Bar', porzione: 280, kcal: 500, proteine: 8, carboidrati: 84, grassi: 15 },
  { nome: 'Piadina con affettati', gruppo: 'Bar', porzione: 250, kcal: 620, proteine: 26, carboidrati: 62, grassi: 30 },
  { nome: 'Insalata di riso', gruppo: 'Bar', porzione: 300, kcal: 520, proteine: 17, carboidrati: 70, grassi: 19 },

  // Cibo veloce
  { nome: 'Hamburger con patatine', gruppo: 'Cibo veloce', porzione: 400, kcal: 900, proteine: 33, carboidrati: 90, grassi: 45 },
  { nome: 'Kebab', gruppo: 'Cibo veloce', porzione: 350, kcal: 750, proteine: 35, carboidrati: 70, grassi: 36 },
  { nome: 'Sushi, dodici pezzi', gruppo: 'Cibo veloce', porzione: 300, kcal: 520, proteine: 24, carboidrati: 80, grassi: 10 },
  { nome: 'Poke bowl', gruppo: 'Cibo veloce', porzione: 400, kcal: 600, proteine: 30, carboidrati: 70, grassi: 22 },

  // Dolci e extra
  { nome: 'Fetta di torta', gruppo: 'Dolce', porzione: 120, kcal: 420, proteine: 6, carboidrati: 55, grassi: 20 },
  { nome: 'Gelato, due gusti', gruppo: 'Dolce', porzione: 150, kcal: 310, proteine: 5, carboidrati: 36, grassi: 16 },
  { nome: 'Cannolo siciliano', gruppo: 'Dolce', porzione: 100, kcal: 400, proteine: 7, carboidrati: 42, grassi: 22 },
  { nome: 'Birra media', gruppo: 'Extra', porzione: 400, kcal: 170, proteine: 1, carboidrati: 13, grassi: 0 },
  { nome: 'Calice di vino', gruppo: 'Extra', porzione: 150, kcal: 125, proteine: 0, carboidrati: 4, grassi: 0 },
  { nome: 'Aperitivo con stuzzichini', gruppo: 'Extra', porzione: 300, kcal: 550, proteine: 10, carboidrati: 45, grassi: 33 },
]

export const GRUPPI_FUORI = [...new Set(PIATTI_FUORI.map((p) => p.gruppo))]
