"""Prova una fonte prima di collegarla.

Una fonte non si aggiunge per sentito dire. Serve che tre cose funzionino di
fila, e se una sola non va la fonte non serve a niente:

1. il sito si lascia leggere - niente 403 a chi non e' un browser
2. il robots.txt dichiara le sitemap, o almeno il ripiego risponde
3. le pagine hanno il JSON-LD `Recipe` che il nostro parser sa leggere

Il terzo punto non lo controlliamo qui: si prova a importare davvero un paio
di indirizzi, e la risposta del web e' la prova. Il parser vive li' e deve
restare uno solo, quindi e' lui a dire se una pagina e' leggibile - esattamente
come nella raccolta normale.

Gira solo quando SONDA_FONTI e' acceso. E' un attrezzo da officina: si accende,
si legge il verdetto nei log, si collega quello che passa e si spegne.
"""

from __future__ import annotations

import os
import random
import time

import httpx

from fonti import CANDIDATE, Fonte
from raccolta import AGENTE, PAUSA, importa, raccogli_indirizzi

# Quanti indirizzi provare per fonte. Bastano pochi: se tre pagine su tre
# hanno il JSON-LD, le altre diecimila ce l'hanno.
QUANTI = int(os.environ.get("SONDA_QUANTI", "3"))


def acceso() -> bool:
    return os.environ.get("SONDA_FONTI", "").strip().lower() in ("1", "si", "true", "on")


def _sonda_una(cliente: httpx.Client, fonte: Fonte, base: str, segreto: str) -> str:
    try:
        candidati = raccogli_indirizzi(cliente, fonte)
    except Exception as errore:
        return f"{fonte.nome}: NON RAGGIUNGIBILE ({errore})"

    if not candidati:
        return f"{fonte.nome}: BOCCIATA - nessun indirizzo che somigli a una ricetta"

    random.shuffle(candidati)
    prove = candidati[:QUANTI]
    lette = 0

    for url in prove:
        if importa(cliente, base, segreto, url):
            lette += 1
        time.sleep(PAUSA)

    if lette == 0:
        return (
            f"{fonte.nome}: BOCCIATA - {len(candidati)} indirizzi ma nessuna"
            f" delle {len(prove)} pagine provate ha una ricetta leggibile"
        )

    return (
        f"{fonte.nome}: PROMOSSA - {lette} su {len(prove)} pagine lette,"
        f" {len(candidati)} indirizzi disponibili"
    )


def sonda() -> list[str]:
    """Il verdetto su ogni candidata. Le ricette lette restano in catalogo."""
    base = os.environ.get("URL_WEB_INTERNO")
    segreto = os.environ.get("SEGRETO_INTERNO")

    if not base or not segreto:
        return ["sondaggio saltato: manca la configurazione"]

    righe: list[str] = []

    with httpx.Client(headers={"user-agent": AGENTE}, follow_redirects=True) as cliente:
        for fonte in CANDIDATE:
            righe.append(_sonda_una(cliente, fonte, base, segreto))

    return righe
