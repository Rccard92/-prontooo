'use client'

import { useEffect } from 'react'

/** Accende il service worker. Se il browser non ce l'ha, non cambia niente. */
export function RegistraSw() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const accendi = () => {
      navigator.serviceWorker.register('/sw.js').catch((errore) => {
        console.error('service worker non registrato:', errore)
      })
    }

    if (document.readyState === 'complete') accendi()
    else window.addEventListener('load', accendi, { once: true })

    return () => window.removeEventListener('load', accendi)
  }, [])

  return null
}
