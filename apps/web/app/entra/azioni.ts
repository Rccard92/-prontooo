'use server'

import { redirect } from 'next/navigation'

import { accedi, esci, registra } from '@/lib/accesso/sessione'

export async function entra(dati: FormData) {
  const esito = await accedi(
    String(dati.get('email') ?? ''),
    String(dati.get('password') ?? ''),
  )

  redirect(esito.ok ? '/' : `/entra?errore=${encodeURIComponent(esito.motivo)}`)
}

export async function iscriviti(dati: FormData) {
  const esito = await registra(
    String(dati.get('nome') ?? ''),
    String(dati.get('email') ?? ''),
    String(dati.get('password') ?? ''),
    String(dati.get('invito') ?? ''),
  )

  redirect(esito.ok ? '/ingredienti' : `/registrati?errore=${encodeURIComponent(esito.motivo)}`)
}

export async function esciDallApp() {
  await esci()
  redirect('/entra')
}
