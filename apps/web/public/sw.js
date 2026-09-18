/**
 * Il service worker: l'app deve funzionare anche senza campo.
 *
 * Il caso vero non e' "sono offline", e' il supermercato sottoterra con la
 * lista della spesa aperta. Quindi: le pagine si prendono dalla rete quando
 * c'e' - i dati cambiano e una lista vecchia e' peggio di nessuna lista - e
 * dalla copia quando la rete non risponde.
 *
 * Quello che non si tocca mai: le POST. Le azioni del server scrivono sul
 * database, e una POST rigiocata dalla copia scriverebbe due volte.
 */
const VERSIONE = 'eprontooo-v1'
const GUSCIO = ['/', '/spesa', '/offerte', '/ingredienti', '/icona-192.png', '/icona-512.png']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSIONE)
      // Una pagina che non risponde non deve far fallire tutta l'installazione.
      .then((cache) => Promise.allSettled(GUSCIO.map((via) => cache.add(via))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chiavi) => Promise.all(chiavi.filter((c) => c !== VERSIONE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request

  if (richiesta.method !== 'GET') return

  const indirizzo = new URL(richiesta.url)

  if (indirizzo.origin !== self.location.origin) return
  // La rotta interna e quelle di servizio non si copiano mai.
  if (indirizzo.pathname.startsWith('/api/')) return

  // Gli statici di Next hanno l'impronta nel nome: se ci sono, sono giusti.
  if (indirizzo.pathname.startsWith('/_next/static/')) {
    evento.respondWith(
      caches.match(richiesta).then(
        (copia) =>
          copia ??
          fetch(richiesta).then((risposta) => {
            const clone = risposta.clone()

            caches.open(VERSIONE).then((cache) => cache.put(richiesta, clone))

            return risposta
          }),
      ),
    )

    return
  }

  evento.respondWith(
    fetch(richiesta)
      .then((risposta) => {
        if (risposta.ok && risposta.type === 'basic') {
          const clone = risposta.clone()

          caches.open(VERSIONE).then((cache) => cache.put(richiesta, clone))
        }

        return risposta
      })
      .catch(async () => {
        const copia = await caches.match(richiesta)

        if (copia) return copia

        // Una navigazione senza copia: meglio la home vecchia di un errore.
        if (richiesta.mode === 'navigate') {
          const casa = await caches.match('/')

          if (casa) return casa
        }

        return new Response('Sei senza rete e questa pagina non ce l’ho in tasca.', {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      }),
  )
})

/** I promemoria arrivano da qui: due al giorno al massimo, mai di piu'. */
self.addEventListener('push', (evento) => {
  let dati = { titolo: 'èProntooo', testo: 'Dai un occhio alla giornata.', via: '/' }

  try {
    if (evento.data) dati = { ...dati, ...evento.data.json() }
  } catch {
    // Push senza corpo leggibile: si mostra quello di base.
  }

  evento.waitUntil(
    self.registration.showNotification(dati.titolo, {
      body: dati.testo,
      icon: '/icona-192.png',
      badge: '/icona-192.png',
      data: { via: dati.via },
      tag: dati.tag ?? 'eprontooo',
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()

  const via = evento.notification.data?.via ?? '/'

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
      for (const finestra of finestre) {
        if (finestra.url.includes(via) && 'focus' in finestra) return finestra.focus()
      }

      return self.clients.openWindow(via)
    }),
  )
})
