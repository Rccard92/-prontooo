import { redirect } from 'next/navigation'

/** `/benvenuto` da solo non e' una schermata: si entra dal primo passo. */
export default function Inizio() {
  redirect('/benvenuto/corpo')
}
