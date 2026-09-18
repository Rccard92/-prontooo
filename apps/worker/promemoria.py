"""Bussa alla rotta dei promemoria del web.

Il worker non decide l'orario e non sa che ore sono a Roma: bussa e basta, una
volta per giro. Chi decide se un promemoria va mandato - e se e' gia' partito
oggi - e' il web, che ha davanti il database. Qui sta solo la bussata, perche'
il worker e' l'unica cosa che gira sempre.
"""

from __future__ import annotations

import os

import httpx


def bussa() -> str:
    base = os.environ.get("URL_WEB_INTERNO")
    segreto = os.environ.get("SEGRETO_INTERNO")

    if not base or not segreto:
        return "promemoria saltati: manca la configurazione"

    try:
        risposta = httpx.post(
            f"{base.rstrip('/')}/api/interno/promemoria",
            headers={"x-segreto-interno": segreto},
            timeout=30,
        )
    except httpx.HTTPError as errore:
        return f"promemoria non chiesti: {errore}"

    if risposta.status_code != 200:
        return f"promemoria: il web ha risposto {risposta.status_code}"

    esito = risposta.json()

    if not esito.get("genere"):
        return "promemoria: niente da mandare"

    return f"promemoria {esito['genere']}: {esito.get('mandati', 0)} mandati"
