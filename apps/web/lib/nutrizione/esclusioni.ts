/**
 * Le esclusioni: l'unico punto da cui si decide se un alimento puo' entrare.
 *
 * Erano applicate in un posto solo - le sostituzioni - e da nessun'altra
 * parte. Chi toglieva il pesce se lo ritrovava a cena, perche' il compositore
 * non le guardava proprio. Adesso tutto passa di qui, e chi aggiunge un pezzo
 * nuovo che sceglie alimenti trova questa funzione sulla strada.
 *
 * Sono **rigide** per definizione: un'esclusione non e' una preferenza, e' una
 * cosa che non deve comparire. Chi ha un'allergia vera deve potersi fidare, e
 * "quasi mai" non e' fidarsi.
 */
export type ConEtichette = { etichette: string[] }

/** L'alimento e' ammesso con queste esclusioni? Quello che non conosciamo passa. */
export function ammesso(alimento: ConEtichette | null | undefined, esclusioni: string[]): boolean {
  if (!alimento || esclusioni.length === 0) return true

  return !alimento.etichette.some((e) => esclusioni.includes(e))
}

/** Tiene solo quello che puo' entrare. */
export function ammessi<T>(
  elenco: T[],
  esclusioni: string[],
  etichetteDi: (voce: T) => string[] | null | undefined,
): T[] {
  if (esclusioni.length === 0) return elenco

  return elenco.filter((voce) => {
    const etichette = etichetteDi(voce)

    return !etichette || !etichette.some((e) => esclusioni.includes(e))
  })
}
