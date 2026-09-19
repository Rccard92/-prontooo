import { eq } from 'drizzle-orm'

import {
  type Alimento,
  type Profilo,
  alimenti as tabellaAlimenti,
  db,
  profilo as tabellaProfilo,
} from '@prontooo/db'

/**
 * Il profilo e il vocabolario, letti dal wizard.
 *
 * Quello che resta del vecchio generatore di piani settimanali: la settimana
 * non e' piu' un'entita' sua, e' sette giornate, quindi `piani` e
 * `piani_pasti` sono spariti. Il profilo invece serve ancora - dice quali
 * fasce vuoi, cosa escludi e su cosa e' tarata la porzione.
 */
export const PROFILO_PREDEFINITO: Omit<Profilo, 'aggiornatoIl' | 'id' | 'utenteId'> = {
  adulti: 2,
  bambini: 0,
  porzioniDefault: 2,
  fasceAttive: ['colazione', 'pranzo', 'cena'],
  giorniFuoriPranzo: [],
  minutiMassimi: { colazione: 15, spuntino: 10, pranzo: 40, merenda: 15, cena: 45 },
  daEvitare: [],
  esclusioni: [],
  impostazione: 'equilibrata',
  alimentiScelti: [],
  settimaneAntiRipetizione: 3,
  // I dati del corpo restano vuoti finche' non li dai tu: senza, le porzioni
  // sono quelle di riferimento del vocabolario.
  sesso: null,
  eta: null,
  altezza: null,
  pesoKg: null,
  attivita: null,
  obiettivo: null,
  condizioni: [],
  regoleSpente: [],
}

export async function leggiProfilo(utenteId: number): Promise<Profilo | null> {
  const [riga] = await db()
    .select()
    .from(tabellaProfilo)
    .where(eq(tabellaProfilo.utenteId, utenteId))
    .limit(1)

  return riga ?? null
}

export async function leggiAlimenti(): Promise<Alimento[]> {
  return db().select().from(tabellaAlimenti).orderBy(tabellaAlimenti.nome)
}

/** I giorni della settimana, per le caselle del wizard. */
export const GIORNI = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
] as const
