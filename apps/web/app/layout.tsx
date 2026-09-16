import type { Metadata } from 'next'
import { Archivo, Yeseva_One } from 'next/font/google'

import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

const yeseva = Yeseva_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-yeseva-one',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Cassetta',
  description: 'Pianifica la settimana, fai la lista, compra dove conviene.',
}

export const viewport = {
  themeColor: '#1b4ba8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${archivo.variable} ${yeseva.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
