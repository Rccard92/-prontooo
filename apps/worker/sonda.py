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
import re
import time

import httpx

from fonti import CANDIDATE, Fonte
from raccolta import AGENTE, PAUSA, importa, raccogli_indirizzi

# Quanti indirizzi provare per fonte.
#
# Tre erano pochi, e il primo sondaggio l'ha dimostrato: Cookaround ha
# ventiduemila indirizzi in sitemap, tre a caso sono finiti tutti su pagine
# che ricette non erano, e la fonte e' risultata bocciata per sfortuna. Con
# dieci, e pescando prima da quelli che sembrano ricette, il verdetto dice
# qualcosa della fonte invece che del sorteggio.
QUANTI = int(os.environ.get("SONDA_QUANTI", "10"))

# Gli indirizzi che hanno "ricetta" o "ricette" nel percorso: quasi tutti i
# siti italiani la mettono li'. Si provano prima, e se non ce ne sono si
# ripiega sugli altri.
SEMBRA_RICETTA = re.compile(r"/ricett", re.IGNORECASE)


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

    # Prima quelli che sembrano ricette dall'indirizzo, poi gli altri: cosi'
    # il verdetto parla della fonte e non della fortuna del sorteggio.
    promettenti = [u for u in candidati if SEMBRA_RICETTA.search(u)]
    altri = [u for u in candidati if not SEMBRA_RICETTA.search(u)]
    prove = (promettenti + altri)[:QUANTI]
    lette = 0

    for url in prove:
        esito = importa(cliente, base, segreto, url)
        lette += 1 if esito else 0
        # L'indirizzo provato si scrive: se una fonte viene bocciata, questo e'
        # quello che serve per capire se era lei o se erano gli indirizzi.
        print(f"  sonda {fonte.nome}: {'letta' if esito else 'niente'} <- {url}", flush=True)
        time.sleep(PAUSA)

    if lette == 0:
        return (
            f"{fonte.nome}: BOCCIATA - {len(candidati)} indirizzi"
            f" ({len(promettenti)} con 'ricetta' nel percorso) ma nessuna"
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
