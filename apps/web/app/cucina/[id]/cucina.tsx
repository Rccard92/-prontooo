'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Gli aiuti che servono davvero mentre cucini: lo schermo acceso e un timer.
 *
 * Prima qui c'era un passo per schermata, con avanti e indietro. Sembrava
 * giusto e non lo era: per sapere cosa viene dopo dovevi toccare, e per
 * tornare su una cosa letta male dovevi tornare indietro - con le mani
 * sporche, che e' il momento in cui il telefono non lo vuoi toccare. Una
 * ricetta si legge tutta, come su un libro aperto sul tavolo.
 *
 * Questi due pero' restano, perche' non sono modi di leggere: sono attrezzi.
 * Lo schermo che non si spegne mentre aspetti la pentola, e i minuti che
 * scorrono senza aprire un'altra app.
 */
export function AiutiCucina() {
  const [timer, setTimer] = useState<number | null>(null)
  const chiusura = useRef<(() => void) | null>(null)

  // Lo schermo resta acceso finche' si sta su questa pagina. Non tutti i
  // telefoni lo permettono, e va bene: e' una comodita', non un requisito.
  useEffect(() => {
    let vivo = true

    const tieniAcceso = async () => {
      try {
        const schermo = (
          navigator as Navigator & {
            wakeLock?: { request: (tipo: 'screen') => Promise<{ release: () => Promise<void> }> }
          }
        ).wakeLock

        if (!schermo) return

        const presa = await schermo.request('screen')

        if (!vivo) {
          void presa.release()

          return
        }

        chiusura.current = () => void presa.release()
      } catch {
        // Negato o non disponibile: si cucina lo stesso.
      }
    }

    void tieniAcceso()

    return () => {
      vivo = false
      chiusura.current?.()
      chiusura.current = null
    }
  }, [])

  useEffect(() => {
    if (timer === null) return

    if (timer <= 0) {
      setTimer(null)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(600)

      return
    }

    const battito = setTimeout(() => setTimer((t) => (t === null ? null : t - 1)), 1000)

    return () => clearTimeout(battito)
  }, [timer])

  const minuti = Math.floor((timer ?? 0) / 60)
  const secondi = (timer ?? 0) % 60

  return (
    <section className="scheda p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fumo">Metti un timer</p>

        {timer !== null ? (
          <button
            type="button"
            onClick={() => setTimer(null)}
            className="pillola cifre bg-limone-tenue text-inchiostro"
          >
            {minuti}:{String(secondi).padStart(2, '0')} · ferma
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[3, 5, 8, 10, 15, 20, 30].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTimer(m * 60)}
            className="pillola cifre bg-fondo text-inchiostro hover:bg-limone-tenue"
          >
            {m} min
          </button>
        ))}
      </div>
    </section>
  )
}
