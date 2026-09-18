import type { Metadata } from 'next'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'

import './globals.css'
import { RegistraSw } from './componenti/registra-sw'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

// Solo per il marchio e i titoli grossi: da' calore senza irrigidire la UI.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK'],
})

export const metadata: Metadata = {
  title: 'èProntooo',
  description: 'Pianifica la settimana, fai la lista, compra dove conviene.',
  applicationName: 'èProntooo',
  appleWebApp: { capable: true, title: 'èProntooo', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icona-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport = {
  themeColor: '#ffffff',
  // Sul telefono l'app sta sotto la tacca e sopra la barra di casa.
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <RegistraSw />
      </body>
    </html>
  )
}
