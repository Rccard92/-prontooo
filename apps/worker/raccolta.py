"""Riempie il catalogo di ricette senza che nessuno debba incollare link.

Scopre le sitemap dal robots.txt di ogni fonte, tiene gli indirizzi che
possono essere ricette, scarta quelli gia' in database e passa i rimanenti al
servizio web, che e' l'unico posto dove vive il parser JSON-LD.

Non prova a indovinare quali indirizzi siano ricette con una regola precisa:
scarta solo quello che di sicuro non lo e' (categorie, tag, allegati) e lascia
decidere al parser. Una pagina senza ricetta torna 422 e si va avanti. E'
meno efficiente di un filtro esatto, ma non si rompe quando un sito cambia
la forma dei suoi indirizzi.

Va piano di proposito: i siti da cui leggiamo non ci devono rimettere niente.
"""

from __future__ import annotations

import os
import random
import time
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

import httpx
import psycopg

from fonti import FONTI, NON_E_UNA_RICETTA, Fonte

AGENTE = "Mozilla/5.0 (compatible; eProntoooBot/0.1; progetto personale)"
SPAZIO_SITEMAP = "{http://www.sitemaps.org/schemas/sitemap/0.9}"

TETTO_PER_GIRO = int(os.environ.get("RICETTE_PER_GIRO", "150"))
PAUSA = float(os.environ.get("PAUSA_FRA_RICETTE", "0.8"))
CATALOGO_OBIETTIVO = int(os.environ.get("CATALOGO_OBIETTIVO", "400"))
# Quante sotto-sitemap aprire per fonte: sono tante, ne bastano poche.
SOTTO_SITEMAP = int(os.environ.get("SOTTO_SITEMAP", "6"))


def sitemap_dichiarate(cliente: httpx.Client, fonte: Fonte) -> list[str]:
    """Le sitemap che il sito dichiara nel suo robots.txt."""
    url = f"{fonte.radice}/robots.txt"

    try:
        risposta = cliente.get(url, timeout=20)
        risposta.raise_for_status()
    except Exception as errore:
        print(f"{fonte.nome}: robots.txt non leggibile ({errore})", flush=True)
        return list(fonte.ripiego)

    dichiarate = [
        riga.split(":", 1)[1].strip()
        for riga in risposta.text.splitlines()
        if riga.lower().startswith("sitemap:")
    ]

    if not dichiarate:
        print(f"{fonte.nome}: robots.txt non dichiara sitemap, uso il ripiego", flush=True)
        return list(fonte.ripiego)

    print(f"{fonte.nome}: {len(dichiarate)} sitemap dichiarate nel robots.txt", flush=True)

    return dichiarate


def _indirizzi(cliente: httpx.Client, url: str, profondita: int = 0) -> list[str]:
    """Gli indirizzi di una sitemap, scendendo negli indici annidati."""
    if profondita > 2:
        return []

    try:
        risposta = cliente.get(url, timeout=40)
        risposta.raise_for_status()
        radice = ET.fromstring(risposta.content)
    except Exception as errore:
        print(f"  sitemap {url} saltata: {errore}", flush=True)
        return []

    trovati = [nodo.text.strip() for nodo in radice.iter(f"{SPAZIO_SITEMAP}loc") if nodo.text]

    if radice.tag.endswith("sitemapindex"):
        annidati: list[str] = []
        for sotto in trovati[:SOTTO_SITEMAP]:
            annidati.extend(_indirizzi(cliente, sotto, profondita + 1))
        return annidati

    return trovati


def puo_essere_ricetta(url: str, fonte: Fonte) -> bool:
    try:
        pezzi = urlparse(url)
    except Exception:
        return False

    if pezzi.hostname not in fonte.host:
        return False

    if NON_E_UNA_RICETTA.search(pezzi.path):
        return False

    # La home e le pagine di primo livello non sono ricette.
    return len([p for p in pezzi.path.split("/") if p]) >= 1 and pezzi.path not in ("/", "")


def raccogli_indirizzi(cliente: httpx.Client, fonte: Fonte) -> list[str]:
    tutti: list[str] = []

    for sitemap in sitemap_dichiarate(cliente, fonte):
        tutti.extend(_indirizzi(cliente, sitemap))

    candidati = [u for u in tutti if puo_essere_ricetta(u, fonte)]

    print(f"{fonte.nome}: {len(candidati)} candidati su {len(tutti)} indirizzi", flush=True)

    for esempio in candidati[:3]:
        print(f"  esempio: {esempio}", flush=True)

    return candidati


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
            timeout=45,
        )
    except Exception as errore:
        print(f"importazione fallita per {url}: {errore}", flush=True)
        return False

    if risposta.status_code == 200:
        return True

    if risposta.status_code == 422:
        # Pagina senza ricetta leggibile: e' il filtro vero, non un errore.
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
            print(f"catalogo a {gia_presenti} ricette: obiettivo raggiunto.", flush=True)
            return 0

        conosciuti = gia_in_catalogo(connessione)

    nuovi: list[str] = []
    quota = TETTO_PER_GIRO // len(FONTI) + 1

    with httpx.Client(headers={"user-agent": AGENTE}, follow_redirects=True) as cliente:
        for fonte in FONTI:
            candidati = [u for u in raccogli_indirizzi(cliente, fonte) if u not in conosciuti]
            random.shuffle(candidati)
            # Un po' per fonte, cosi' il catalogo non diventa monotematico.
            nuovi.extend(candidati[:quota])

        random.shuffle(nuovi)
        da_fare = nuovi[:TETTO_PER_GIRO]

        print(f"provo a importare {len(da_fare)} indirizzi", flush=True)

        importate = 0
        for url in da_fare:
            if importa(cliente, base, segreto, url):
                importate += 1
            time.sleep(PAUSA)

    print(f"raccolta finita: {importate} ricette nuove in catalogo", flush=True)

    return importate
