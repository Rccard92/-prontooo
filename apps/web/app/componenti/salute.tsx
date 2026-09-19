import { CONDIZIONI, chiaveRegola } from '@/lib/nutrizione/condizioni'
import { ATTENUAZIONI } from '@/lib/nutrizione/attenuazioni'
import { ESCLUSIONI } from '@/lib/nutrizione/impostazioni'

/**
 * Le due schermate che parlano di salute, scritte una volta sola.
 *
 * Le usano il benvenuto e il profilo. Sono la stessa cosa e devono restare la
 * stessa cosa: se le regole di Hashimoto si scrivono in due posti, prima o
 * poi in uno dei due ne manca una.
 */

/**
 * Le patologie, con le loro regole chiuse dentro finche' non le accendi.
 *
 * Prima le regole stavano sempre in vista e gia' spuntate, anche sotto una
 * condizione spenta: sembravano attive quando non lo erano. Adesso la
 * fisarmonica si apre quando spunti la patologia, e le regole dentro sono
 * gia' spuntate perche' quelle sono i suggerimenti - togliere una spunta li'
 * vuol dire "questa a me non convince", che e' una cosa diversa dal non aver
 * ancora scelto.
 *
 * Si apre senza una riga di JavaScript: la casella vera fa da `peer` e il
 * pannello e' un suo fratello. Questa pagina e' un componente server, e per
 * aprire un accordion non vale la pena di renderla altro.
 */
export function Condizioni({
  accese,
  regoleSpente,
}: {
  accese: string[]
  regoleSpente: string[]
}) {
  return (
    <div className="flex flex-col gap-3">
      {CONDIZIONI.map((c) => (
        <div
          key={c.id}
          className="rounded-controllo flex flex-wrap items-start gap-x-3 gap-y-0 bg-fondo p-4"
        >
          <input
            type="checkbox"
            id={`condizione-${c.id}`}
            name={`condizione-${c.id}`}
            value="si"
            defaultChecked={accese.includes(c.id)}
            className="peer mt-1 size-5 shrink-0 accent-basilico"
          />
          <label
            htmlFor={`condizione-${c.id}`}
            className="min-w-0 flex-1 cursor-pointer select-none"
          >
            <span className="block text-base font-semibold text-inchiostro">{c.nome}</span>
            <span className="block text-sm text-fumo">{c.spiega}</span>
          </label>

          <div className="mt-3 hidden w-full border-t border-bordo pt-3 peer-checked:block">
            <p className="mb-2 text-xs font-semibold tracking-wide text-fumo uppercase">
              Cosa cambia nel piano
            </p>

            <div className="flex flex-col gap-2">
              {c.regole.map((r) => (
                <label
                  key={r.id}
                  className="rounded-controllo flex cursor-pointer items-start gap-3 bg-bianco px-3 py-2"
                >
                  <input
                    type="checkbox"
                    name={`regola-${chiaveRegola(c.id, r.id)}`}
                    value="si"
                    defaultChecked={!regoleSpente.includes(chiaveRegola(c.id, r.id))}
                    className="mt-0.5 size-4 shrink-0 accent-basilico"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-inchiostro">{r.cosaFa}</span>
                    <span className="block text-xs text-fumo">{r.quantoSiSa}</span>
                  </span>
                </label>
              ))}
            </div>

            {(c.esclusioniSuggerite ?? []).map((e) => (
              <p
                key={e.etichetta}
                className="rounded-controllo mt-2 bg-limone-tenue px-3 py-2 text-xs text-inchiostro"
              >
                {e.perche}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Cosa togliere - e, per due etichette, cosa fare invece di toglierlo.
 *
 * Il glutine e il lattosio non sono come il pesce. Fra "mangio tutto" e "via
 * per sempre" c'e' il caso piu' comune di tutti: gli esami dicono che non sei
 * celiaco ma quando esageri con pasta e pane stai gonfio, oppure il lattosio
 * ti da' fastidio ma la mozzarella senza lattosio sta al banco accanto.
 *
 * Per quelle due la domanda ha tre risposte invece di due. Per le altre sette
 * resta la casella, perche' una via di mezzo fra "mangio il pesce" e "non
 * mangio il pesce" non esiste.
 */
export function CosaTogliere({
  esclusioni,
  attenuazioni,
  suggerite = [],
}: {
  esclusioni: string[]
  attenuazioni: string[]
  /** Etichette che una condizione accesa propone: si evidenziano, non si spuntano. */
  suggerite?: { etichetta: string; perche: string; condizione: string }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      {ESCLUSIONI.map((e) => {
        const proposta = suggerite.find((s) => s.etichetta === e.id)
        const viaDiMezzo = ATTENUAZIONI.find((a) => a.etichetta === e.id)
        const sfondo = proposta ? 'bg-limone-tenue' : 'bg-fondo'

        const intestazione = (
          <>
            <span className="block text-base font-semibold text-inchiostro">{e.nome}</span>
            <span className="block text-sm text-fumo">{e.spiega}</span>
            {proposta ? (
              <span className="mt-1 block text-sm text-inchiostro">
                <strong>{proposta.condizione}:</strong> {proposta.perche}
              </span>
            ) : null}
          </>
        )

        if (!viaDiMezzo) {
          return (
            <label
              key={e.id}
              className={`rounded-controllo flex cursor-pointer items-start gap-3 px-4 py-3 ${sfondo}`}
            >
              <input
                type="checkbox"
                name={`esclusione-${e.id}`}
                value="si"
                defaultChecked={esclusioni.includes(e.id)}
                className="mt-0.5 size-5 shrink-0 accent-basilico"
              />
              <span>{intestazione}</span>
            </label>
          )
        }

        // Tre risposte: normale, la via di mezzo, via per sempre. Il valore
        // sta su un gruppo di radio perche' sono davvero alternative - non
        // si puo' insieme ridurre il glutine e non averlo.
        const scelto = esclusioni.includes(e.id)
          ? 'togli'
          : attenuazioni.includes(e.id)
            ? 'attenua'
            : 'no'

        const opzioni = [
          { id: 'no', nome: 'Lo mangio', spiega: 'Nessun cambiamento.' },
          { id: 'attenua', nome: viaDiMezzo.nome, spiega: viaDiMezzo.cosaFa },
          { id: 'togli', nome: 'Toglilo del tutto', spiega: 'Non comparirà mai, da nessuna parte.' },
        ]

        return (
          <div key={e.id} className={`rounded-controllo px-4 py-3 ${sfondo}`}>
            {intestazione}

            <div className="mt-3 flex flex-col gap-2">
              {opzioni.map((o) => (
                <label
                  key={o.id}
                  className="rounded-controllo flex cursor-pointer items-start gap-3 bg-bianco px-3 py-2"
                >
                  <input
                    type="radio"
                    name={`modo-${e.id}`}
                    value={o.id}
                    defaultChecked={scelto === o.id}
                    className="mt-0.5 size-4 shrink-0 accent-basilico"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-inchiostro">{o.nome}</span>
                    <span className="block text-xs text-fumo">{o.spiega}</span>
                  </span>
                </label>
              ))}
            </div>

            <p className="mt-2 text-xs text-fumo">{viaDiMezzo.quantoSiSa}</p>
          </div>
        )
      })}
    </div>
  )
}
