"""Riempie il catalogo di ricette senza che nessuno debba incollare link.

Legge le sitemap delle fonti, tiene solo gli indirizzi che sembrano ricette,
scarta quelli gia' in database e passa i rimanenti al servizio web, che e'
l'unico posto dove vive il parser JSON-LD.

Gira a cron. Va piano di proposito: i siti da cui leggiamo non ci devono
rimettere niente.
"""

from __future__ import annotations

import os
import random
import time
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

import httpx
import psycopg

from fonti import FONTI, Fonte

AGENTE = "Mozilla/5.0 (compatible; eProntoooBot/0.1; progetto personale)"
SPAZIO_SITEMAP = "{http://www.sitemaps.org/schemas/sitemap/0.9}"

# Quante ricette nuove al massimo per giro, e quanto aspettare fra una e l'altra.
TETTO_PER_GIRO = int(os.environ.get("RICETTE_PER_GIRO", "60"))
PAUSA = float(os.environ.get("PAUSA_FRA_RICETTE", "1.5"))
CATALOGO_OBIETTIVO = int(os.environ.get("CATALOGO_OBIETTIVO", "400"))


def _indirizzi(cliente: httpx.Client, url: str, profondita: int = 0) -> list[str]:
    """Gli indirizzi di una sitemap, scendendo negli indici annidati."""
    if profondita > 2:
        return []

    try:
        risposta = cliente.get(url, timeout=30)
        risposta.raise_for_status()
        radice = ET.fromstring(risposta.content)
    except Exception as errore:  # sitemap rotta o irraggiungibile: si tira dritto
        print(f"sitemap {url} non leggibile: {errore}", flush=True)
        return []

    trovati = [nodo.text.strip() for nodo in radice.iter(f"{SPAZIO_SITEMAP}loc") if nodo.text]

    if radice.tag == f"{SPAZIO_SITEMAP}sitemapindex":
        annidati: list[str] = []
        # Le sitemap di ricette sono tante: ne bastano poche per riempire il catalogo.
        for sotto in trovati[:8]:
            annidati.extend(_indirizzi(cliente, sotto, profondita + 1))
        return annidati

    return trovati


def raccogli_indirizzi(cliente: httpx.Client, fonte: Fonte) -> list[str]:
    tutti = _indirizzi(cliente, fonte.sitemap)
    ricette = [u for u in tutti if fonte.riconosci.match(u)]

    print(f"{fonte.nome}: {len(ricette)} indirizzi di ricetta su {len(tutti)}", flush=True)

    return ricette


def gia_in_catalogo(connessione: psycopg.Connection) -> set[str]:
    with connessione.cursor() as cursore:
        cursore.execute("select fonte_url from ricette")
        return {riga[0] for riga in cursore.fetchall()}


def quante_ricette(connessione: psycopg.Connection) -> int:
    with connessione.cursor() as cursore:
        cursore.execute("select count(*) from ricette")
        riga = cursore.fetchone()
        return int(riga[0]) if riga else 0


def importa(cliente: httpx.Client, base: str, segreto: str, url: str) -> bool:
    """Passa un indirizzo al web, che lo parsifica e lo salva."""
    try:
        risposta = cliente.post(
            f"{base}/api/interno/importa",
            json={"url": url},
            headers={"x-segreto-interno": segreto},
            timeout=40,
        )
    except Exception as errore:
        print(f"importazione fallita per {url}: {errore}", flush=True)
        return False

    if risposta.status_code == 200:
        return True

    if risposta.status_code == 422:
        # Pagina senza ricetta leggibile: capita, non e' un errore nostro.
        return False

    print(f"il web ha risposto {risposta.status_code} per {url}", flush=True)
    return False


def raccogli(url_db: str) -> int:
    base = os.environ.get("URL_WEB_INTERNO")
    segreto = os.environ.get("SEGRETO_INTERNO")

    if not base or not segreto:
        print("URL_WEB_INTERNO o SEGRETO_INTERNO mancanti: salto la raccolta.", flush=True)
        return 0

    with psycopg.connect(url_db, connect_timeout=15) as connessione:
        gia_presenti = quante_ricette(connessione)

        if gia_presenti >= CATALOGO_OBIETTIVO:
            print(f"catalogo a {gia_presenti} ricette: obiettivo raggiunto, non raccolgo.", flush=True)
            return 0

        conosciuti = gia_in_catalogo(connessione)

    nuovi: list[str] = []

    with httpx.Client(headers={"user-agent": AGENTE}, follow_redirects=True) as cliente:
        for fonte in FONTI:
            candidati = [u for u in raccogli_indirizzi(cliente, fonte) if u not in conosciuti]
            random.shuffle(candidati)
            # Un po' per fonte, cosi' il catalogo non diventa monotematico.
            nuovi.extend(candidati[: TETTO_PER_GIRO // len(FONTI) + 1])

        random.shuffle(nuovi)
        da_fare = nuovi[:TETTO_PER_GIRO]

        print(f"provo a importare {len(da_fare)} ricette nuove", flush=True)

        importate = 0
        for url in da_fare:
            if importa(cliente, base, segreto, url):
                importate += 1
            time.sleep(PAUSA)

    print(f"raccolta finita: {importate} ricette nuove in catalogo", flush=True)

    return importate
