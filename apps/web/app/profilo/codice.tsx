'use client'

import { useState } from 'react'

/**
 * Il codice invito, con un tasto per copiarlo.
 *
 * Mostrarlo qui non regala niente: per stare su questa pagina bisogna essere
 * entrati, e per entrare quel codice l'hai gia' usato. L'unico che non l'ha
 * mai digitato e' il primo iscritto, che e' il padrone di casa.
 *
 * Il tasto e' l'unica riga di JavaScript della pagina, e c'e' per una ragione
 * pratica: un codice lo devi passare a qualcuno, e selezionarlo a dito su un
 * telefono e' il modo piu' facile di sbagliarlo.
 */
export function CodiceInvito({ codice }: { codice: string }) {
  const [copiato, setCopiato] = useState(false)

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(codice)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2000)
    } catch {
      // Niente appunti: il codice resta scritto li' e si seleziona a mano.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded-controllo cifre flex-1 bg-fondo px-3 py-2 text-base font-semibold tracking-wide text-inchiostro">
        {codice}
      </code>

      <button
        type="button"
        onClick={copia}
        className="bottone-chiaro shrink-0 hover:bg-basilico hover:text-bianco"
      >
        {copiato ? 'Copiato' : 'Copia'}
      </button>
    </div>
  )
}
