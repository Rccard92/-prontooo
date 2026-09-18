'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Modalita' cucina: un passo alla volta, schermo acceso.
 *
 * In cucina hai le mani sporche e il telefono appoggiato al muro. Quindi:
 * caratteri grandi, un passo per schermata, avanti con un tocco qualsiasi
 * sulla scheda, e lo schermo che non si spegne mentre aspetti la pentola.
 */
export function Cucina({ passi, titolo }: { passi: string[]; titolo: string }) {
  const [indice, setIndice] = useState(0)
  const [timer, setTimer] = useState<number | null>(null)
  const chiusura = useRef<(() => void) | null>(null)

  // Lo schermo resta acceso finche' si cucina. Non tutti i telefoni lo
  // permettono, e va bene: e' una comodita', non un requisito.
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

  const avanti = useCallback(() => setIndice((i) => Math.min(i + 1, passi.length - 1)), [passi.length])
  const indietro = useCallback(() => setIndice((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const tasto = (evento: KeyboardEvent) => {
      if (evento.key === 'ArrowRight' || evento.key === ' ') avanti()
      if (evento.key === 'ArrowLeft') indietro()
    }

    window.addEventListener('keydown', tasto)

    return () => window.removeEventListener('keydown', tasto)
  }, [avanti, indietro])

  const ultimo = indice === passi.length - 1
  const minuti = Math.floor((timer ?? 0) / 60)
  const secondi = (timer ?? 0) % 60

  return (
    <section className="scheda p-5 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <span className="pillola bg-basilico-tenue text-basilico-scuro">
          Passo {indice + 1} di {passi.length}
        </span>
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

      <div className="mt-1 flex gap-1">
        {passi.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= indice ? 'bg-basilico' : 'bg-fondo'}`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={avanti}
        className="mt-6 w-full text-left text-2xl leading-relaxed font-semibold text-inchiostro sm:text-3xl"
      >
        {passi[indice]}
      </button>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={indietro}
          disabled={indice === 0}
          className="bottone-chiaro disabled:opacity-40"
        >
          Indietro
        </button>
        <button
          type="button"
          onClick={avanti}
          disabled={ultimo}
          className="bottone disabled:opacity-40"
        >
          {ultimo ? 'È pronto' : 'Fatto, avanti'}
        </button>
      </div>

      <div className="mt-6 border-t border-bordo pt-4">
        <p className="text-sm font-semibold text-fumo">Metti un timer</p>
        <div className="mt-2 flex flex-wrap gap-2">
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
      </div>

      <p className="sr-only">{titolo}</p>
    </section>
  )
}
