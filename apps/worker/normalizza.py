"""Bussa alla rotta che normalizza il catalogo.

Stessa divisione delle ricette e dei volantini: il worker e' l'unica cosa che
gira sempre, quindi fa da sveglia; il lavoro lo fa il web, perche' il
vocabolario e il modello stanno li' e devono restare uno solo.

Un blocco alla volta, non tutto il catalogo in una volta. Tre motivi, e sono
tutti e tre pratici: il vocabolario resta nella cache del prompt fra una
ricetta e l'altra, un errore costa un blocco invece di un giro intero, e la
spesa si spalma su qualche ora invece di arrivare tutta insieme. Con 419
ricette e un blocco di venti ogni mezz'ora il catalogo e' letto in mezza
giornata, e non c'e' nessuna fretta di arrivarci prima.

Quando non resta piu' niente da leggere la bussata costa un conteggio e via.
"""

from __future__ import annotations

import os

import httpx

# Quante ricette per giro. Si alza con RICETTE_PER_GIRO se si ha fretta.
PER_GIRO = int(os.environ.get("RICETTE_PER_GIRO", "20"))


def bussa() -> str:
    base = os.environ.get("URL_WEB_INTERNO")
    segreto = os.environ.get("SEGRETO_INTERNO")

    if not base or not segreto:
        return "normalizzazione saltata: manca la configurazione"

    try:
        risposta = httpx.post(
            f"{base.rstrip('/')}/api/interno/normalizza",
            headers={"x-segreto-interno": segreto},
            json={"quante": PER_GIRO},
            # Venti ricette una dopo l'altra: il tempo va dato.
            timeout=300,
        )
    except httpx.HTTPError as errore:
        return f"normalizzazione non chiesta: {errore}"

    # 503 con un motivo: manca la chiave. Non e' un guasto, e il log lo dice
    # in chiaro invece di lasciare un numero da interpretare.
    if risposta.status_code == 503:
        try:
            motivo = risposta.json().get("motivo", "servizio non disponibile")
        except ValueError:
            motivo = "servizio non disponibile"

        return f"normalizzazione ferma: {motivo}"

    if risposta.status_code != 200:
        return f"normalizzazione: il web ha risposto {risposta.status_code}"

    esito = risposta.json()

    if esito.get("normalizzate", 0) == 0 and esito.get("restanti", 0) == 0:
        return "catalogo gia' tutto normalizzato"

    return (
        f"normalizzate {esito.get('normalizzate', 0)} ricette"
        f" ({esito.get('convertite', 0)} entrano nel piano,"
        f" {esito.get('fallite', 0)} da riprovare),"
        f" ne restano {esito.get('restanti', 0)}"
    )
