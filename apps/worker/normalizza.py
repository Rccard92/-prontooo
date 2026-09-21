"""Bussa alla rotta che normalizza il catalogo.

Stessa divisione delle ricette e dei volantini: il worker e' l'unica cosa che
gira sempre, quindi fa da sveglia; il lavoro lo fa il web, perche' il
vocabolario e il modello stanno li' e devono restare uno solo.

A blocchi, non tutto il catalogo in una chiamata sola. Tre motivi, e sono tutti
e tre pratici: il vocabolario resta nella cache del prompt fra una ricetta e
l'altra, un errore costa un blocco invece di tutto il lavoro, e la spesa si
spalma invece di arrivare in un colpo.

Pero' nemmeno un blocco solo per giro: 419 ricette a venti ogni mezz'ora
vorrebbero dire dieci ore prima di vedere la prima foto nella scheda di oggi.
Quindi finche' c'e' arretrato il giro ne fa qualche blocco di fila - fino a
`BLOCCHI_PER_GIRO` - e smette appena la coda e' vuota. A regime resta una
bussata sola che costa un conteggio: le ricette nuove arrivano poche per volta,
e il primo blocco le prende tutte.
"""

from __future__ import annotations

import os

import httpx

# Quante ricette per blocco. Il web ne accetta al massimo 50.
PER_BLOCCO = int(os.environ.get("RICETTE_PER_BLOCCO", "20"))

# Quanti blocchi di fila, finche' c'e' arretrato. Cinque blocchi da venti sono
# cento ricette per giro: il catalogo si legge in un paio d'ore invece che in
# dieci, e il giro resta comunque molto piu' corto del sonno che lo segue.
#
# Zero vuol dire fermo, ed e' un freno vero: si mette la variabile a 0 su
# Railway e la lettura si ferma al giro dopo, senza un deploy. Serve quando si
# sta per cambiare il vocabolario - leggere ricette col vocabolario vecchio
# vuol dire pagarle due volte.
BLOCCHI_PER_GIRO = int(os.environ.get("BLOCCHI_PER_GIRO", "5"))


def _rimetti_in_coda(base: str, segreto: str) -> str:
    """Chiede al web di rimettere in coda le ricette lette ma non convertite.

    Attrezzo da officina, come il sondaggio delle fonti: si accende con
    RIMETTI_IN_CODA, si legge quante ne sono tornate in coda, **si spegne**.
    Serve quando il vocabolario si allarga - una ricetta ferma su
    "pangrattato" merita un secondo tentativo adesso che il pangrattato lo
    conosciamo.

    Lasciarlo acceso e' una perdita vera: le ricette che non passano non
    passeranno nemmeno al giro dopo, e rimetterle in coda ogni mezz'ora vuol
    dire rileggerle ogni mezz'ora, pagando ogni volta lo stesso niente.
    """
    try:
        risposta = httpx.post(
            f"{base.rstrip('/')}/api/interno/normalizza",
            headers={"x-segreto-interno": segreto},
            json={"rileggi": True},
            timeout=120,
        )
    except httpx.HTTPError as errore:
        return f"rimessa in coda non chiesta: {errore}"

    if risposta.status_code != 200:
        return f"rimessa in coda: il web ha risposto {risposta.status_code}"

    esito = risposta.json()

    return (
        f"riclassificate {esito.get('riclassificate', 0)} ricette,"
        f" rimesse in coda {esito.get('rimesseInCoda', 0)}"
    )


def _catalogo(esito: dict) -> str:
    """Il catalogo in una riga, cosi' come il web l'ha contato.

    Quattro numeri e non uno perche' rispondono a quattro domande diverse, e
    quella che conta e' l'ultima: non quante ricette abbiamo preso dai siti,
    ma quante hanno i posti e finiscono davvero nella schermata di oggi.
    """
    c = esito.get("catalogo") or {}

    if not c:
        return ""

    return (
        f"\n  catalogo: {c.get('raccolte', 0)} raccolte,"
        f" {c.get('daPiano', 0)} da pranzo o cena,"
        f" {c.get('lette', 0)} lette,"
        f" {c.get('nelPiano', 0)} nel piano"
    )


def _riclassifica(base: str, segreto: str) -> str:
    """Rimette in ordine i ruoli di quello che c'e' gia' in catalogo.

    Separato dalla rimessa in coda, e per un motivo di soldi: questo non costa
    niente e fa risparmiare - un dolce che torna a essere un dolce esce dalla
    coda e non lo si legge piu' - mentre rimettere in coda si paga. Finche'
    erano la stessa richiesta, per avere il risparmio bisognava comprare la
    spesa.

    Si accende con RICLASSIFICA dopo aver cambiato la tabella delle parole in
    fasce.ts, si legge quante ne ha spostate, si spegne.
    """
    try:
        risposta = httpx.post(
            f"{base.rstrip('/')}/api/interno/normalizza",
            headers={"x-segreto-interno": segreto},
            json={"riclassifica": True},
            timeout=120,
        )
    except httpx.HTTPError as errore:
        return f"riclassificazione non chiesta: {errore}"

    if risposta.status_code != 200:
        return f"riclassificazione: il web ha risposto {risposta.status_code}"

    return f"riclassificate {risposta.json().get('riclassificate', 0)} ricette"


def _ricostruisci(base: str, segreto: str) -> str:
    """Rifa' i posti delle ricette gia' lette, senza ripagare il modello.

    Si puo' perche' la normalizzazione salva l'alimento riga per riga, non
    solo i posti: il lavoro che si paga e' gia' in archivio, e rifare i posti
    da li' e' aritmetica.

    Attrezzo da officina come gli altri: si accende con RICOSTRUISCI_POSTI dopo
    aver cambiato la regola che fabbrica i posti, si legge quante ne ha
    rifatte, si spegne. Duemila UPDATE ogni mezz'ora non servono a nessuno.
    """
    try:
        risposta = httpx.post(
            f"{base.rstrip('/')}/api/interno/normalizza",
            headers={"x-segreto-interno": segreto},
            json={"ricostruisci": True},
            # Duemila ricette da ricalcolare e riscrivere: il tempo va dato.
            timeout=600,
        )
    except httpx.HTTPError as errore:
        return f"ricostruzione non chiesta: {errore}"

    if risposta.status_code != 200:
        return f"ricostruzione: il web ha risposto {risposta.status_code}"

    return f"ricostruiti i posti di {risposta.json().get('ricostruite', 0)} ricette"


def _solo_stato(base: str, segreto: str) -> str:
    """I conteggi del catalogo, senza leggere niente."""
    try:
        risposta = httpx.post(
            f"{base.rstrip('/')}/api/interno/normalizza",
            headers={"x-segreto-interno": segreto},
            json={"stato": True},
            timeout=60,
        )
    except httpx.HTTPError:
        return ""

    if risposta.status_code != 200:
        return ""

    return _catalogo(risposta.json())


def _un_blocco(base: str, segreto: str) -> tuple[str, int | None]:
    """Un blocco solo. Torna il messaggio e quante ne restano, se si sa."""
    try:
        risposta = httpx.post(
            f"{base.rstrip('/')}/api/interno/normalizza",
            headers={"x-segreto-interno": segreto},
            json={"quante": PER_BLOCCO},
            # Venti ricette una dopo l'altra: il tempo va dato.
            timeout=300,
        )
    except httpx.HTTPError as errore:
        return f"normalizzazione non chiesta: {errore}", None

    # 503 con un motivo: manca la chiave. Non e' un guasto, e il log lo dice
    # in chiaro invece di lasciare un numero da interpretare.
    if risposta.status_code == 503:
        try:
            motivo = risposta.json().get("motivo", "servizio non disponibile")
        except ValueError:
            motivo = "servizio non disponibile"

        return f"normalizzazione ferma: {motivo}", None

    if risposta.status_code != 200:
        return f"normalizzazione: il web ha risposto {risposta.status_code}", None

    esito = risposta.json()
    restanti = esito.get("restanti", 0)

    if esito.get("normalizzate", 0) == 0 and restanti == 0:
        return "catalogo gia' tutto normalizzato", 0

    messaggio = (
        f"normalizzate {esito.get('normalizzate', 0)} ricette"
        f" ({esito.get('convertite', 0)} entrano nel piano,"
        f" {esito.get('fallite', 0)} da riprovare),"
        f" ne restano {restanti}"
    )

    # Le righe che il vocabolario non conosce sono il motivo per cui una
    # ricetta su otto entra nel piano invece di tutte. Stamparle e' il modo di
    # sapere cosa aggiungere invece di indovinarlo.
    sconosciute = esito.get("sconosciute") or []

    if sconosciute:
        elenco = ", ".join(f"{v.get('riga')} x{v.get('quante')}" for v in sconosciute)
        messaggio += f"\n  al vocabolario mancano: {elenco}"

    # Le righe mancanti dicono cosa manca, queste dicono come e' distribuito, e
    # sono due lavori diversi: una riga difficile su otto e' una ricetta da
    # riscattare allargando il vocabolario, otto su otto e' una ricetta che in
    # catalogo non doveva entrare.
    bloccate = esito.get("bloccate") or []

    if bloccate:
        elenco = ", ".join(
            f"{v.get('titolo')} ({v.get('nonCapite')}/{v.get('righe')})" for v in bloccate
        )
        messaggio += f"\n  restano fuori: {elenco}"

    return messaggio, restanti


def _acceso(nome: str) -> bool:
    """Gli attrezzi da officina si accendono con una variabile, e si spengono."""
    return os.environ.get(nome, "").strip().lower() in ("1", "si", "true", "on")


def bussa() -> str:
    base = os.environ.get("URL_WEB_INTERNO")
    segreto = os.environ.get("SEGRETO_INTERNO")

    if not base or not segreto:
        return "normalizzazione saltata: manca la configurazione"

    if BLOCCHI_PER_GIRO <= 0:
        # In pausa si smette di leggere, non di guardare: il conteggio non
        # chiama nessun modello e dice a che punto e' rimasto il catalogo.
        return "normalizzazione in pausa: BLOCCHI_PER_GIRO e' a zero" + _solo_stato(
            base, segreto
        )

    righe: list[str] = []
    prima = None

    # Prima di leggere, non dopo: cosi' quelle rimesse in coda - e quelle che
    # la riclassificazione toglie dalla coda - contano da questo giro.
    # Prima di tutto: cambia cosa le ricette sono, e il resto del giro lavora
    # su quello.
    if _acceso("RICOSTRUISCI_POSTI"):
        righe.append(_ricostruisci(base, segreto))

    if _acceso("RICLASSIFICA"):
        righe.append(_riclassifica(base, segreto))

    if _acceso("RIMETTI_IN_CODA"):
        righe.append(_rimetti_in_coda(base, segreto))

    for _ in range(BLOCCHI_PER_GIRO):
        messaggio, restanti = _un_blocco(base, segreto)
        righe.append(messaggio)

        # `None` vuol dire che il blocco non e' andato: la chiave manca, il web
        # non risponde, qualcosa e' rotto. Insistere altre quattro volte
        # riempirebbe i log della stessa riga senza cambiare niente.
        if restanti is None or restanti == 0:
            break

        # La coda non si e' accorciata: quel blocco e' fallito tutto, e una
        # ricetta fallita resta in testa alla fila. Senza questa riga il giro
        # ripescherebbe le stesse venti altre quattro volte, pagandole ogni
        # volta. Si riprova al giro dopo, non adesso.
        if prima is not None and restanti >= prima:
            righe.append("mi fermo: la coda non si accorcia, riprovo al prossimo giro")
            break

        prima = restanti

    # In coda al giro, una volta sola: e' la riga che risponde alla domanda che
    # ci si fa davvero - a che punto siamo. Prima usciva solo quando la coda
    # finiva, cioe' proprio mai durante un arretrato, che e' quando la si
    # vuole. Costa una query di conteggio ogni mezz'ora.
    righe.append(_solo_stato(base, segreto).strip() or "catalogo: non l'ho saputo contare")

    return " | ".join(righe)
