import { desc } from 'drizzle-orm'
import Link from 'next/link'

import { db, ricette } from '@prontooo/db'

import { Testata, durata } from './componenti/testata'

export const dynamic = 'force-dynamic'

type RigaCatalogo = {
  id: number
  titolo: string
  immagineUrl: string | null
  minutiTotali: number | null
  porzioni: number | null
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

/**
 * La card e' un'etichetta: foto piena in cima, sotto il blocco cobalto col
 * titolo. Niente bordo, niente angoli tondi, niente ombra: quello che separa
 * una card dall'altra e' il colore pieno.
 */
function Etichetta({ riga }: { riga: RigaCatalogo }) {
  const tempo = durata(riga.minutiTotali)

  return (
    <Link href={`/ricette/${riga.id}`} className="group block">
      <div className="aspect-4/3 w-full overflow-hidden bg-inchiostro">
        {riga.immagineUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- le foto arrivano da domini arbitrari
          <img
            src={riga.immagineUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center px-4">
            <span className="font-display text-2xl text-zagara/50">senza foto</span>
          </div>
        )}
      </div>

      <div className="bg-cobalto px-4 py-4 group-hover:bg-inchiostro">
        <h2 className="font-display text-2xl leading-tight text-zagara">{riga.titolo}</h2>
        <p className="mt-2 text-sm text-carta/70">
          {[tempo, riga.porzioni ? `${riga.porzioni} porzioni` : null, riga.fonteNome]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </Link>
  )
}

function Vuoto({
  titolo,
  testo,
  invito,
}: {
  titolo: string
  testo: string
  invito?: string
}) {
  return (
    <div className="cornice">
      <div className="cornice-interna bg-cobalto px-6 py-14 sm:px-12">
        <h2 className="font-display text-3xl text-zagara sm:text-4xl">{titolo}</h2>
        <p className="mt-4 max-w-lg text-lg text-carta">{testo}</p>
        {invito ? (
          <Link
            href="/importa"
            className="mt-8 inline-block bg-zagara px-6 py-3 text-lg text-inchiostro"
          >
            {invito}
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export default async function Catalogo() {
  const righe = await leggiCatalogo()

  return (
    <div className="min-h-dvh bg-carta">
      <Testata attiva="catalogo" />

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
        {righe === null ? (
          <Vuoto
            titolo="Il database non risponde"
            testo="Il catalogo non e leggibile in questo momento. Il dettaglio sta nei log del deploy."
          />
        ) : righe.length === 0 ? (
          <Vuoto
            titolo="Il catalogo e vuoto"
            testo="Incolla il link di una ricetta e finisce qui dentro. Da li si costruisce tutto il resto: il piano della settimana, la lista della spesa, le offerte."
            invito="Importa la prima ricetta"
          />
        ) : (
          <>
            <h1 className="font-display text-4xl text-inchiostro sm:text-5xl">
              {righe.length} ricette
            </h1>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {righe.map((riga) => (
                <Etichetta key={riga.id} riga={riga} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
