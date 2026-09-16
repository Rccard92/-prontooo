import type { Metadata } from 'next'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'

import './globals.css'

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
}

export const viewport = {
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
