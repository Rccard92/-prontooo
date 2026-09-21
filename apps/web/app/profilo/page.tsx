import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { db, profilo as tabellaProfilo } from '@prontooo/db'

import { FASCE, NOME_FASCIA } from '@/lib/ricette/fasce'
import { leggiCosaTogliere } from '@/lib/nutrizione/attenuazioni'
import { CONDIZIONI, chiaveRegola, esclusioniSuggeriteDa } from '@/lib/nutrizione/condizioni'
import { IMPOSTAZIONI } from '@/lib/nutrizione/impostazioni'
import {
  ATTIVITA,
  type DatiCorpo,
  NOME_ATTIVITA,
  NOME_OBIETTIVO,
  OBIETTIVI,
  SESSI,
  datiCompleti,
  fabbisognoDi,
} from '@/lib/nutrizione/fabbisogno'
import { utenteObbligatorio } from '@/lib/accesso/sessione'
import { GIORNI, PROFILO_PREDEFINITO, leggiAlimenti, leggiProfilo } from '@/lib/profilo/leggi'

import { Condizioni, CosaTogliere } from '../componenti/salute'
import { Navigazione } from '../componenti/navigazione'
import { esciDallApp } from '../entra/azioni'
import { CodiceInvito } from './codice'

export const dynamic = 'force-dynamic'

function numero(dati: FormData, campo: string, predefinito: number): number {
  const valore = Number(dati.get(campo))

  return Number.isFinite(valore) && valore >= 0 ? Math.round(valore) : predefinito
}

function decimale(dati: FormData, campo: string): number | null {
  const grezzo = String(dati.get(campo) ?? '').replace(',', '.').trim()

  if (grezzo.length === 0) return null

  const n = Number(grezzo)

  return Number.isFinite(n) ? n : null
}

function fraQuelli<T extends string>(valore: string, ammessi: readonly T[]): T | undefined {
  return (ammessi as readonly string[]).includes(valore) ? (valore as T) : undefined
}

async function salva(dati: FormData) {
  'use server'

  const corpo: Partial<DatiCorpo> = {
    sesso: fraQuelli(String(dati.get('sesso') ?? ''), SESSI),
    eta: decimale(dati, 'eta') ?? undefined,
    altezza: decimale(dati, 'altezza') ?? undefined,
    pesoKg: decimale(dati, 'peso') ?? undefined,
    attivita: fraQuelli(String(dati.get('attivita') ?? ''), ATTIVITA),
    obiettivo: fraQuelli(String(dati.get('obiettivo') ?? ''), OBIETTIVI),
  }

  // Senza questi non si calcola niente, e le porzioni tornerebbero a essere
  // numeri generici: si ferma qui invece di salvare un profilo a meta'.
  if (!datiCompleti(corpo)) {
    redirect(
      '/profilo?errore=' +
        encodeURIComponent('Servono età, altezza e peso: da lì nascono le tue porzioni.'),
    )
  }

  const fasceAttive = FASCE.filter((f) => dati.get(`fascia-${f}`) === 'si')

  const minutiMassimi: Record<string, number> = {}
  for (const fascia of fasceAttive) {
    minutiMassimi[fascia] = numero(dati, `minuti-${fascia}`, 45)
  }

  const giorniFuoriPranzo: number[] = GIORNI.map((_, i) => i).filter(
    (i) => dati.get(`fuori-${i}`) === 'si',
  )

  const daEvitare = String(dati.get('daEvitare') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  const cosaTogliere = leggiCosaTogliere((campo) => {
    const valore = dati.get(campo)

    return typeof valore === 'string' ? valore : null
  })

  const condizioni = CONDIZIONI.map((c) => c.id).filter(
    (id) => dati.get(`condizione-${id}`) === 'si',
  )

  // Si salvano solo le regole spente delle condizioni accese: cosi' spegnere
  // una condizione e riaccenderla non si porta dietro scelte dimenticate.
  const regoleSpente = CONDIZIONI.filter((c) => condizioni.includes(c.id)).flatMap((c) =>
    c.regole
      .filter((r) => dati.get(`regola-${chiaveRegola(c.id, r.id)}`) !== 'si')
      .map((r) => chiaveRegola(c.id, r.id)),
  )

  const scelti = dati.getAll('alimento').map((v) => Number(v)).filter(Number.isInteger)

  const impostazione = String(dati.get('impostazione') ?? 'equilibrata')

  const utenteId = await utenteObbligatorio()

  const valori = {
    // Il profilo porta l'id dell'utente: uno e uno solo per pannello.
    id: utenteId,
    utenteId,
    adulti: numero(dati, 'adulti', 2),
    bambini: numero(dati, 'bambini', 0),
    porzioniDefault: numero(dati, 'porzioni', 2),
    fasceAttive: (fasceAttive.length > 0 ? [...fasceAttive] : ['pranzo', 'cena']) as string[],
    giorniFuoriPranzo,
    minutiMassimi,
    daEvitare,
    esclusioni: cosaTogliere.esclusioni as string[],
    attenuazioni: cosaTogliere.attenuazioni as string[],
    impostazione: IMPOSTAZIONI.some((i) => i.id === impostazione) ? impostazione : 'equilibrata',
    alimentiScelti: scelti,
    settimaneAntiRipetizione: numero(dati, 'antiRipetizione', 3),
    sesso: corpo.sesso,
    eta: corpo.eta,
    altezza: corpo.altezza,
    pesoKg: corpo.pesoKg.toFixed(2),
    attivita: corpo.attivita,
    obiettivo: corpo.obiettivo,
    condizioni,
    regoleSpente,
    aggiornatoIl: new Date(),
  }

  await db()
    .insert(tabellaProfilo)
    .values(valori)
    .onConflictDoUpdate({ target: tabellaProfilo.id, set: valori })

  redirect('/profilo?salvato=1')
}

function Sezione({
  titolo,
  spiega,
  children,
}: {
  titolo: string
  spiega?: string
  children: React.ReactNode
}) {
  return (
    <section className="scheda p-6 sm:p-8">
      <h2 className="font-marchio text-2xl text-inchiostro">{titolo}</h2>
      {spiega ? <p className="mt-2 text-sm text-fumo">{spiega}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  )
}

const campo =
  'rounded-controllo w-full border border-bordo bg-fondo px-3 py-2 text-base text-inchiostro outline-none focus:border-basilico'

function Numero({
  nome,
  etichetta,
  valore,
  max = 20,
}: {
  nome: string
  etichetta: string
  valore: number
  max?: number
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-inchiostro">{etichetta}</span>
      <input
        type="number"
        name={nome}
        id={nome}
        min={0}
        max={max}
        defaultValue={valore}
        className={`${campo} cifre mt-1.5`}
      />
    </label>
  )
}

const NOME_GRUPPO: Record<string, string> = {
  cereale: 'Cereali e riso',
  tubero: 'Patate',
  pane: 'Pane e sostituti',
  legume: 'Legumi',
  carne: 'Carne',
  pesce: 'Pesce',
  uova: 'Uova',
  latticino: 'Latticini',
  verdura: 'Verdure',
  frutta: 'Frutta',
  grasso: 'Condimenti',
  frutta_secca: 'Frutta secca e semi',
  dolce: 'Dolce',
  bevanda: 'Bevande',
}

export default async function Profilo({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string; salvato?: string }>
}) {
  const { errore, salvato: appenaSalvato } = await searchParams
  const utenteId = await utenteObbligatorio()
  const salvato = await leggiProfilo(utenteId)
  const p = salvato ?? {
    ...PROFILO_PREDEFINITO,
    id: utenteId,
    utenteId,
    aggiornatoIl: new Date(),
  }
  const alimenti = await leggiAlimenti()
  const scelti = new Set(p.alimentiScelti)

  const corpo: Partial<DatiCorpo> = {
    sesso: (p.sesso ?? undefined) as DatiCorpo['sesso'] | undefined,
    eta: p.eta ?? undefined,
    altezza: p.altezza ?? undefined,
    pesoKg: p.pesoKg === null || p.pesoKg === undefined ? undefined : Number(p.pesoKg),
    attivita: (p.attivita ?? undefined) as DatiCorpo['attivita'] | undefined,
    obiettivo: (p.obiettivo ?? undefined) as DatiCorpo['obiettivo'] | undefined,
  }

  const conto = datiCompleti(corpo) ? fabbisognoDi(corpo) : null
  const primaVolta = conto === null

  // Si legge qui, sul server, e arriva alla pagina gia' scritto: e' lo stesso
  // valore che `registra` confronta, quindi non c'e' modo che quello mostrato
  // e quello che funziona siano due cose diverse.
  const invito = process.env.CODICE_INVITO?.trim() ?? ''

  const perGruppo = new Map<string, typeof alimenti>()
  for (const a of alimenti) {
    perGruppo.set(a.gruppo, [...(perGruppo.get(a.gruppo) ?? []), a])
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">
          {primaVolta ? 'Prima di cominciare' : 'Il tuo profilo'}
        </h1>
        <p className="mt-2 max-w-xl text-base text-fumo">
          {primaVolta
            ? 'Da qui nascono le tue porzioni e il piano. Senza questi dati i grammi sarebbero numeri generici, uguali per tutti.'
            : 'Cambia quello che vuoi, quando vuoi: oggi vuoi perdere peso, fra un anno mantenere, e il piano si sposta con te.'}
        </p>

        {errore ? (
          <p className="rounded-controllo mt-5 bg-pomodoro-tenue px-4 py-3 text-sm text-pomodoro">
            {errore}
          </p>
        ) : null}

        {appenaSalvato ? (
          <p className="rounded-controllo mt-5 bg-basilico-tenue px-4 py-3 text-sm text-basilico-scuro">
            Salvato. I pasti si rifanno su questi numeri.
          </p>
        ) : null}

        {conto ? (
          <section className="scheda mt-6 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-marchio text-xl text-inchiostro">Il tuo fabbisogno</h2>
              <span className="cifre text-sm text-fumo">fermo: {conto.basale} kcal</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { nome: 'Kcal al giorno', valore: String(conto.giornaliero) },
                { nome: 'Proteine', valore: `${conto.proteine} g` },
                { nome: 'Carboidrati', valore: `${conto.carboidrati} g` },
                { nome: 'Grassi', valore: `${conto.grassi} g` },
              ].map((v) => (
                <div key={v.nome} className="rounded-controllo bg-fondo px-4 py-3">
                  <p className="cifre text-xl font-bold text-inchiostro">{v.valore}</p>
                  <p className="text-sm text-fumo">{v.nome}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <form action={salva} className="mt-6 flex flex-col gap-5">
          <Sezione
            titolo="Come sei fatto"
            spiega="Serve a calcolare le porzioni invece di indovinarle. Resta nel tuo pannello e non lo vede nessun altro."
          >
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-semibold text-inchiostro">Sesso</span>
                  <select name="sesso" defaultValue={corpo.sesso ?? 'uomo'} className={`${campo} mt-1.5`}>
                    <option value="uomo">Uomo</option>
                    <option value="donna">Donna</option>
                  </select>
                </label>
                <Numero nome="eta" etichetta="Età" valore={corpo.eta ?? 30} max={100} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Numero nome="altezza" etichetta="Altezza in cm" valore={corpo.altezza ?? 175} max={230} />
                <label className="block">
                  <span className="block text-sm font-semibold text-inchiostro">Peso in kg</span>
                  <input
                    type="text"
                    name="peso"
                    inputMode="decimal"
                    required
                    defaultValue={corpo.pesoKg ?? ''}
                    className={`${campo} cifre mt-1.5`}
                  />
                </label>
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-inchiostro">Quanto ti muovi</legend>
                <div className="mt-2 flex flex-col gap-1.5">
                  {ATTIVITA.map((a) => (
                    <label
                      key={a}
                      className="rounded-controllo flex cursor-pointer items-center gap-3 bg-fondo px-3 py-2"
                    >
                      <input
                        type="radio"
                        name="attivita"
                        value={a}
                        defaultChecked={(corpo.attivita ?? 'moderato') === a}
                        className="size-4 accent-basilico"
                      />
                      <span className="text-sm text-inchiostro">{NOME_ATTIVITA[a]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold text-inchiostro">Cosa vuoi ottenere</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OBIETTIVI.map((o) => (
                    <label
                      key={o}
                      className="rounded-controllo flex cursor-pointer items-center gap-2 bg-fondo px-3 py-2"
                    >
                      <input
                        type="radio"
                        name="obiettivo"
                        value={o}
                        defaultChecked={(corpo.obiettivo ?? 'mantenere') === o}
                        className="size-4 accent-basilico"
                      />
                      <span className="text-sm text-inchiostro">{NOME_OBIETTIVO[o]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <p className="rounded-controllo bg-limone-tenue px-4 py-3 text-sm text-inchiostro">
                Il conto è quello standard — Mifflin-St Jeor, il fattore di attività,
                l&rsquo;obiettivo — e resta una stima: un nutrizionista guarda esami e storia, che
                una formula non vede. Se hai una dieta vera, caricala e vince quella.
              </p>
            </div>
          </Sezione>
          <Sezione titolo="Chi mangia">
            <div className="grid grid-cols-3 gap-4">
              <Numero nome="adulti" etichetta="Adulti" valore={p.adulti} />
              <Numero nome="bambini" etichetta="Bambini" valore={p.bambini} />
              <Numero nome="porzioni" etichetta="Porzioni" valore={p.porzioniDefault} />
            </div>
          </Sezione>

          <Sezione
            titolo="Cosa pianifico"
            spiega="Spunta solo i pasti che vuoi davvero nel piano, e dimmi quanto tempo hai per ognuno."
          >
            <div className="flex flex-col gap-3">
              {FASCE.map((fascia) => {
                const attiva = p.fasceAttive.includes(fascia)

                return (
                  <div
                    key={fascia}
                    className="rounded-controllo flex items-center justify-between gap-4 bg-fondo px-4 py-3"
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name={`fascia-${fascia}`}
                        id={`fascia-${fascia}`}
                        value="si"
                        defaultChecked={attiva}
                        className="size-5 accent-basilico"
                      />
                      <span className="text-base font-semibold text-inchiostro">
                        {NOME_FASCIA[fascia]}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 text-sm text-fumo">
                      entro
                      <input
                        type="number"
                        name={`minuti-${fascia}`}
                        id={`minuti-${fascia}`}
                        min={5}
                        max={240}
                        step={5}
                        defaultValue={p.minutiMassimi[fascia] ?? 45}
                        className="cifre rounded-controllo w-20 border border-bordo bg-bianco px-2 py-1.5 text-right text-inchiostro outline-none focus:border-basilico"
                      />
                      min
                    </label>
                  </div>
                )
              })}
            </div>
          </Sezione>

          <Sezione
            titolo="Quando sei fuori a pranzo"
            spiega="Quei pranzi non entrano nel piano e non finiscono nella lista della spesa."
          >
            <div className="flex flex-wrap gap-2">
              {GIORNI.map((giorno, i) => (
                <label
                  key={giorno}
                  className="rounded-controllo flex items-center gap-2 bg-fondo px-3 py-2"
                >
                  <input
                    type="checkbox"
                    name={`fuori-${i}`}
                    id={`fuori-${i}`}
                    value="si"
                    defaultChecked={p.giorniFuoriPranzo.includes(i)}
                    className="size-4 accent-basilico"
                  />
                  <span className="text-sm font-semibold text-inchiostro">
                    {giorno.slice(0, 3)}
                  </span>
                </label>
              ))}
            </div>
          </Sezione>

          <Sezione
            titolo="Cosa togliere"
            spiega="Quello che togli non entra mai nel piano. Glutine e lattosio hanno anche una via di mezzo: ridurre invece di togliere, o sostituire con la versione che sta al banco accanto."
          >
            <CosaTogliere
              esclusioni={p.esclusioni}
              attenuazioni={p.attenuazioni}
              suggerite={esclusioniSuggeriteDa(p.condizioni)}
            />

            <p className="rounded-controllo bg-limone-tenue mt-4 px-4 py-3 text-sm text-inchiostro">
              Queste valgono sugli alimenti, quindi sono affidabili. Sulle <em>ricette</em> del
              catalogo no: lì gli ingredienti non sono ancora normalizzati. Se hai un&rsquo;allergia
              vera, non fidarti di un suggerimento di ricetta.
            </p>
          </Sezione>

          <Sezione
            titolo="Come stai di salute"
            spiega="Se c'è qualcosa che già sai di te, scrivilo qui una volta sola e il piano ne tiene conto. Non è una diagnosi: è una preferenza scritta bene."
          >
            <Condizioni accese={p.condizioni} regoleSpente={p.regoleSpente} />

            <p className="rounded-controllo mt-4 bg-fondo px-4 py-3 text-sm text-fumo">
              Nessuna di queste toglie un alimento per sempre: spostano quanto spesso esce. Quello
              che non deve comparire mai si mette in <strong>Cosa togliere</strong>, qui sopra.
            </p>
          </Sezione>

          <Sezione
            titolo="Come vuoi mangiare"
            spiega="Non toglie alimenti: sposta le proporzioni fra i ruoli del pasto. Una sola."
          >
            <div className="flex flex-col gap-2">
              {IMPOSTAZIONI.map((i) => (
                <label
                  key={i.id}
                  className="rounded-controllo flex items-start gap-3 bg-fondo px-4 py-3"
                >
                  <input
                    type="radio"
                    name="impostazione"
                    id={`impostazione-${i.id}`}
                    value={i.id}
                    defaultChecked={p.impostazione === i.id}
                    className="mt-0.5 size-5 shrink-0 accent-basilico"
                  />
                  <span>
                    <span className="block text-base font-semibold text-inchiostro">{i.nome}</span>
                    <span className="block text-sm text-fumo">{i.spiega}</span>
                  </span>
                </label>
              ))}
            </div>
          </Sezione>

          <Sezione
            titolo="Gli ingredienti che vuoi usare"
            spiega="Spunta quello che ti va di mangiare: il piano pesca prima da qui. Se non spunti niente pesco da tutto."
          >
            <div className="flex flex-col gap-5">
              {[...perGruppo.entries()].map(([gruppo, voci]) => (
                <div key={gruppo}>
                  <h3 className="text-sm font-bold text-inchiostro">
                    {NOME_GRUPPO[gruppo] ?? gruppo}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {voci.map((a) => (
                      <label key={a.id} className="cursor-pointer">
                        <input
                          type="checkbox"
                          name="alimento"
                          id={`alimento-${a.id}`}
                          value={a.id}
                          defaultChecked={scelti.has(a.id)}
                          className="peer sr-only"
                        />
                        <span className="pillola bg-fondo text-fumo peer-checked:bg-basilico peer-checked:text-bianco">
                          {a.nome}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <input type="hidden" name="daEvitare" value={p.daEvitare.join(', ')} />
          </Sezione>

          <Sezione
            titolo="Ogni quanto può tornare una ricetta"
            spiega="Per quante settimane una ricetta già cucinata resta fuori dal piano."
          >
            <Numero
              nome="antiRipetizione"
              etichetta="Settimane"
              valore={p.settimaneAntiRipetizione}
              max={12}
            />
          </Sezione>

          <button type="submit" className="bottone w-full hover:bg-basilico-scuro">
            {salvato ? 'Salva le preferenze' : 'Salva e genera la settimana'}
          </button>
        </form>

        {/* Il codice per far entrare qualcun altro. Sta qui e non su Railway
            perche' e' una cosa che si passa a voce o in chat, e andare a
            cercarlo in un pannello di deploy ogni volta non e' un modo di
            invitare nessuno. */}
        <section className="scheda mt-6 p-5">
          <h2 className="font-marchio text-xl text-inchiostro">Invita qualcuno</h2>

          {invito ? (
            <>
              <p className="mt-1 mb-3 text-sm text-fumo">
                Con questo codice si crea il suo pannello: la sua dieta, i suoi giorni, il suo
                peso. Non vede i tuoi.
              </p>
              <CodiceInvito codice={invito} />
              <p className="mt-3 text-sm text-fumo">
                È uno solo e vale per tutti. Se gira troppo lo cambi da Railway, e il vecchio
                smette di funzionare subito.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-fumo">
              Non c&rsquo;è nessun codice impostato, quindi le iscrizioni sono chiuse: nessuno può
              crearsi un pannello. Si riapre mettendo <code className="cifre">CODICE_INVITO</code>{' '}
              fra le variabili del servizio web.
            </p>
          )}
        </section>

        {/* Quello che stava nella testata e nella barra in basso non ci sta:
            cinque voci sono quante ne prende il pollice. La lista la scrivi
            una volta e l'uscita la usi quasi mai, e tutte e due sono roba
            tua - qui sono a casa loro. */}
        <div className="scheda mt-6 divide-y divide-bordo">
          <Link
            href="/ingredienti"
            className="flex items-center justify-between px-5 py-4 text-base font-semibold text-inchiostro"
          >
            I tuoi ingredienti
            <span className="text-sm font-normal text-fumo">Cosa puoi mangiare</span>
          </Link>

          <Link
            href="/ricette"
            className="flex items-center justify-between px-5 py-4 text-base font-semibold text-inchiostro"
          >
            Sfoglia le ricette
            <span className="text-sm font-normal text-fumo">Tutto il catalogo</span>
          </Link>

          <form action={esciDallApp}>
            <button type="submit" className="w-full px-5 py-4 text-left text-base font-semibold text-pomodoro">
              Esci
            </button>
          </form>
        </div>
      </main>
      <Navigazione attiva="profilo" />
    </div>
  )
}
