import Link from 'next/link'

/**
 * Dice che l'app e' aperta a chiunque abbia il link.
 *
 * Qui dentro ci sono la tua dieta, cosa mangi e quanto pesi. Finche'
 * `APP_PASSPHRASE` non e' impostata su Railway questa roba sta su un indirizzo
 * pubblico, e questo va detto dove lo vedi - non in un file di
 * configurazione che non apri mai.
 */
export function AvvisoAperto() {
  if (process.env.APP_PASSPHRASE) return null

  return (
    <div className="rounded-scheda mt-5 bg-limone-tenue px-5 py-4">
      <p className="font-semibold text-inchiostro">L&rsquo;app è aperta a chiunque abbia il link</p>
      <p className="mt-1 text-sm text-inchiostro">
        Qui dentro ci sono la tua dieta, cosa mangi e quanto pesi. Per chiuderla imposta{' '}
        <code className="cifre rounded bg-bianco px-1.5 py-0.5">APP_PASSPHRASE</code> fra le
        variabili del servizio <strong>web</strong> su Railway: al riavvio ti verrà chiesta una
        volta sola per dispositivo.{' '}
        <Link href="/entra" className="font-semibold underline underline-offset-4">
          La schermata di accesso c&rsquo;è già
        </Link>
        .
      </p>
    </div>
  )
}
