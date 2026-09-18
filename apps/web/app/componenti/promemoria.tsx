'use client'

import { useEffect, useState } from 'react'

import { disiscriviTelefono, iscriviTelefono } from '../azioni-promemoria'

/** La chiave pubblica VAPID arriva in base64url e il browser la vuole in byte. */
function inByte(base64url: string): ArrayBuffer {
  const riempito = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const pieno = riempito + '='.repeat((4 - (riempito.length % 4)) % 4)
  const grezzo = atob(pieno)
  const buffer = new ArrayBuffer(grezzo.length)
  const byte = new Uint8Array(buffer)

  for (let i = 0; i < grezzo.length; i += 1) byte[i] = grezzo.charCodeAt(i)

  return buffer
}

type Stato = 'ignoto' | 'non_supportato' | 'spento' | 'acceso' | 'negato' | 'attesa'

/**
 * Il pulsante dei promemoria.
 *
 * Non chiede niente da solo: il permesso alle notifiche si chiede quando
 * qualcuno preme, mai all'apertura. Un pannello che compare da solo appena
 * apri l'app lo neghi per riflesso, e poi non si torna piu' indietro.
 */
export function Promemoria({ chiavePubblica }: { chiavePubblica: string }) {
  const [stato, setStato] = useState<Stato>('ignoto')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStato('non_supportato')

      return
    }

    if (Notification.permission === 'denied') {
      setStato('negato')

      return
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((iscrizione) => setStato(iscrizione ? 'acceso' : 'spento'))
      .catch(() => setStato('spento'))
  }, [])

  if (!chiavePubblica || stato === 'ignoto' || stato === 'non_supportato') return null

  const accendi = async () => {
    setStato('attesa')

    try {
      const permesso = await Notification.requestPermission()

      if (permesso !== 'granted') {
        setStato(permesso === 'denied' ? 'negato' : 'spento')

        return
      }

      const registrazione = await navigator.serviceWorker.ready
      const iscrizione = await registrazione.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: inByte(chiavePubblica),
      })

      const dati = iscrizione.toJSON()

      await iscriviTelefono({
        endpoint: iscrizione.endpoint,
        p256dh: dati.keys?.p256dh ?? '',
        auth: dati.keys?.auth ?? '',
      })

      setStato('acceso')
    } catch (errore) {
      console.error('promemoria non accesi:', errore)
      setStato('spento')
    }
  }

  const spegni = async () => {
    setStato('attesa')

    try {
      const registrazione = await navigator.serviceWorker.ready
      const iscrizione = await registrazione.pushManager.getSubscription()

      if (iscrizione) {
        await disiscriviTelefono(iscrizione.endpoint)
        await iscrizione.unsubscribe()
      }

      setStato('spento')
    } catch (errore) {
      console.error('promemoria non spenti:', errore)
      setStato('acceso')
    }
  }

  if (stato === 'negato') {
    return (
      <p className="mt-4 text-sm text-fumo">
        Le notifiche sono bloccate per questo sito. Si riaprono dalle impostazioni del telefono.
      </p>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={stato === 'acceso' ? spegni : accendi}
        disabled={stato === 'attesa'}
        className={stato === 'acceso' ? 'pillola bg-fondo text-fumo' : 'bottone-chiaro'}
      >
        {stato === 'attesa'
          ? 'Un attimo…'
          : stato === 'acceso'
            ? 'Spegni i promemoria'
            : 'Accendi i promemoria'}
      </button>
      <span className="text-sm text-fumo">
        Due soli: la sera se non hai registrato, il giovedì per fare la settimana.
      </span>
    </div>
  )
}
