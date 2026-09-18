import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'èProntooo',
    short_name: 'èProntooo',
    description: 'Pianifica la settimana, fai la lista, compra dove conviene.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6FAF7',
    theme_color: '#1EB85C',
    lang: 'it',
    orientation: 'portrait',
    icons: [
      { src: '/icona-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'La spesa', short_name: 'Spesa', url: '/spesa' },
      { name: 'Gli ingredienti', short_name: 'Ingredienti', url: '/ingredienti' },
    ],
  }
}
