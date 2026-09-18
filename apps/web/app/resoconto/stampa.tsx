'use client'

/** Il pulsante che apre la stampa. Da lì il telefono salva in PDF. */
export function Stampa() {
  return (
    <button type="button" onClick={() => window.print()} className="bottone hover:bg-basilico-scuro">
      Stampa o salva in PDF
    </button>
  )
}
