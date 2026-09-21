import { desc } from 'drizzle-orm'
import Link from 'next/link'

import { db, ricette } from '@prontooo/db'

import { Navigazione, durata } from '../componenti/navigazione'

export const dynamic = 'force-dynamic'

type RigaCatalogo = {
  id: number
  titolo: string
  immagineUrl: string | null
  minutiTotali: number | null
  porzioni: number | null
  ruolo: string | null
  fonteNome: string
}

async function leggiCatalogo(): Promise<RigaCatalogo[] | null> {
  try {
    return await db()
      .select({
        id: ricette.id,
        titolo: ricette.titolo,
        immagineUrl: ricette.immagineUrl,
        minutiTotali: ricette.minutiTotali,
        porzioni: ricette.porzioni,
        ruolo: ricette.ruolo,
        fonteNome: ricette.fonteNome,
      })
      .from(ricette)
      .orderBy(desc(ricette.importataIl))
      .limit(60)
  } catch (errore) {
    console.error('lettura catalogo fallita:', errore)

    return null
  }
}

/** Ogni ruolo ha il suo colore e il suo nome, sempre gli stessi in tutta l'app. */
const stileRuolo: Record<string, { nome: string; classe: string }> = {
  primo: { nome: 'Primo', classe: 'bg-basilico-tenue text-basilico-scuro' },
  secondo: { nome: 'Secondo', classe: 'bg-pomodoro-tenue text-pomodoro' },
  piatto_unico: { nome: 'Piatto unico', classe: 'bg-basilico-tenue text-basilico-scuro' },
  dolce: { nome: 'Dolce', classe: 'bg-limone-tenue text-inchiostro' },
  lievitato: { nome: 'Lievitato', classe: 'bg-limone-tenue text-inchiostro' },
  antipasto: { nome: 'Antipasto', classe: 'bg-basilico-tenue text-basilico-scuro' },
  contorno: { nome: 'Contorno', classe: 'bg-basilico-tenue text-basilico-scuro' },
  bevanda: { nome: 'Bevanda', classe: 'bg-limone-tenue text-inchiostro' },
}

function Scheda({ riga }: { riga: RigaCatalogo }) {
  const tempo = durata(riga.minutiTotali)
  const stile = riga.ruolo ? stileRuolo[riga.ruolo] : undefined

  return (
    <Link
      href={`/ricette/${riga.id}`}
      className="scheda group block overflow-hidden transition-shadow hover:shadow-sollevata"
    >
      <div className="aspect-4/3 w-full overflow-hidden bg-basilico-tenue">
        {riga.immagineUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- le foto arrivano da domini arbitrari
          <img src={riga.immagineUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="font-marchio text-xl text-basilico-scuro">senza foto</span>
          </div>
        )}
      </div>

      <div className="p-4">
        {stile ? <span className={`pillola ${stile.classe}`}>{stile.nome}</span> : null}

        <h2 className="mt-2 text-lg leading-snug font-bold text-inchiostro">{riga.titolo}</h2>

        <p className="cifre mt-1.5 text-sm text-fumo">
          {[tempo, riga.porzioni ? `${riga.porzioni} porzioni` : null, riga.fonteNome]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </Link>
  )
}

function Avviso({
  titolo,
  testo,
  invito,
  tono = 'sereno',
}: {
  titolo: string
  testo: string
  invito?: string
  tono?: 'sereno' | 'rotto'
}) {
  return (
    <div className="scheda px-6 py-12 text-center sm:px-12">
      <h2
        className={`font-marchio text-3xl ${tono === 'rotto' ? 'text-pomodoro' : 'text-inchiostro'}`}
      >
        {titolo}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-base text-fumo">{testo}</p>
      {invito ? (
        <Link href="/importa" className="bottone mt-8 hover:bg-basilico-scuro">
          {invito}
        </Link>
      ) : null}
    </div>
  )
}

export default async function Catalogo() {
  const righe = await leggiCatalogo()

  return (
    <div className="min-h-dvh bg-fondo">
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {righe === null ? (
          <Avviso
            tono="rotto"
            titolo="Il database non risponde"
            testo="Le ricette non sono leggibili in questo momento. Il dettaglio sta nei log del deploy."
          />
        ) : righe.length === 0 ? (
          <Avviso
            titolo="Ancora nessuna ricetta"
            testo="Il catalogo si riempirà da solo quando il wizard sarà pronto. Nel frattempo puoi incollare un link a mano."
            invito="Incolla una ricetta"
          />
        ) : (
          <>
            <h1 className="font-marchio text-3xl text-inchiostro sm:text-4xl">
              {righe.length} ricette
            </h1>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {righe.map((riga) => (
                <Scheda key={riga.id} riga={riga} />
              ))}
            </div>
          </>
        )}
      </main>
      <Navigazione />
    </div>
  )
}
