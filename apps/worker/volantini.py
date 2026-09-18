"""Scarica i volantini da solo, una volta a settimana.

Niente upload a mano: il worker va sulla pagina dei volantini di ogni insegna,
trova il PDF e lo passa al web, che e' l'unico posto dove vive il lettore dei
volantini. E' la stessa divisione delle ricette: qui si decide **cosa**
scaricare, di la' si sa **come** leggerlo.

Un volantino dura una settimana, quindi il giro non si fa a ogni ciclo: prima
si guarda in database se per quell'insegna ce n'e' gia' uno fresco. Il ciclo
del worker gira ogni mezz'ora e questa funzione, nel caso normale, costa una
query e basta.

Le pagine dei volantini cambiano spesso, e il PDF non sta sempre nello stesso
posto. Per questo non si cerca un indirizzo preciso: si prende la pagina e si
cercano **tutti** i link a un PDF, tenendo il primo che sembra un volantino.
Quando una fonte smette di funzionare i log lo dicono con chiarezza, invece di
tacere.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
import psycopg

AGENTE = "Mozilla/5.0 (compatible; eProntoooBot/0.1; progetto personale)"

# Ogni quanti giorni ha senso riprovare un'insegna. Un volantino dura una
# settimana; si riprova prima per non perdere il cambio.
GIORNI_FRESCHEZZA = int(os.environ.get("VOLANTINI_GIORNI", "5"))

# Quanto puo' pesare un volantino. Sopra questa soglia non lo scarichiamo
# nemmeno: e' un catalogo stagionale, non il volantino della settimana.
MASSIMO_BYTE = 40 * 1024 * 1024


@dataclass(frozen=True)
class FonteVolantino:
    insegna: str
    # La pagina da cui partire a cercare.
    pagina: str
    # Il punto vendita, quando l'insegna ne ha uno solo che ci interessa.
    punto_vendita: str | None = None


def fonti() -> list[FonteVolantino]:
    """Le insegne da guardare.

    Conad sta in una variabile e non nel codice per un motivo di dominio: e'
    una cooperativa, il volantino cambia per cooperativa regionale e per
    negozio, e l'indirizzo giusto e' quello del **tuo** punto vendita. Scriverne
    uno qui dentro vorrebbe dire mostrare prezzi che non sono quelli che paghi.
    """
    elenco = [
        FonteVolantino("Lidl", "https://www.lidl.it/c/it-IT/volantini/s10005610"),
        FonteVolantino("Eurospin", "https://www.eurospin.it/volantini/"),
        FonteVolantino("MD", "https://www.mdspa.it/volantini/"),
    ]

    conad = os.environ.get("VOLANTINO_CONAD_URL", "").strip()

    if conad:
        elenco.append(
            FonteVolantino(
                "Conad",
                conad,
                os.environ.get("CONAD_PUNTO_VENDITA", "").strip() or None,
            )
        )

    return elenco


# Un PDF che non e' il volantino: regolamenti, informative, moduli.
NON_E_UN_VOLANTINO = re.compile(
    r"(privacy|cookie|informativ|regolament|condizioni|termini|modulo|contratt"
    r"|bilancio|certificat|allergen|nutrizional)",
    re.IGNORECASE,
)


def pdf_nella_pagina(cliente: httpx.Client, pagina: str) -> list[str]:
    """Tutti i link a PDF di una pagina, dal piu' promettente.

    Non si guarda solo negli `href`: molte pagine costruiscono l'elenco in
    JavaScript e l'indirizzo del PDF finisce dentro un blob JSON. Cercare il
    pattern su tutto il testo li prende entrambi.
    """
    risposta = cliente.get(pagina, timeout=30)
    risposta.raise_for_status()

    grezzi = re.findall(r"""["'(]([^"'()\s]+?\.pdf[^"'()\s]*)["')]""", risposta.text, re.IGNORECASE)

    visti: list[str] = []

    for grezzo in grezzi:
        intero = urljoin(str(risposta.url), grezzo.replace("&amp;", "&"))

        if NON_E_UN_VOLANTINO.search(intero):
            continue

        if intero not in visti:
            visti.append(intero)

    # Chi ha "volantino" nell'indirizzo passa davanti: e' quasi sempre lui.
    visti.sort(key=lambda u: 0 if re.search(r"volantin|flyer|offert", u, re.I) else 1)

    return visti


def gia_fresco(connessione: psycopg.Connection, insegna: str) -> bool:
    with connessione.cursor() as cursore:
        cursore.execute(
            "select 1 from volantini"
            " where insegna = %s and caricato_il > now() - make_interval(days => %s)"
            " limit 1",
            (insegna, GIORNI_FRESCHEZZA),
        )
        return cursore.fetchone() is not None


def manda_al_web(
    cliente: httpx.Client, base: str, segreto: str, fonte: FonteVolantino, nome: str, pdf: bytes
) -> str:
    """Passa il PDF al web, che sa leggerlo. Torna una riga da mettere nei log."""
    risposta = cliente.post(
        f"{base.rstrip('/')}/api/interno/volantino",
        headers={"x-segreto-interno": segreto},
        files={"volantino": (nome, pdf, "application/pdf")},
        data={
            "insegna": fonte.insegna,
            "puntoVendita": fonte.punto_vendita or "",
            "nomeFile": nome,
        },
        timeout=180,
    )

    if risposta.status_code == 200:
        esito = risposta.json()
        return (
            f"{fonte.insegna}: {esito.get('quante', 0)} offerte,"
            f" {esito.get('certe', 0)} agganciate con certezza"
        )

    if risposta.status_code == 422:
        return f"{fonte.insegna}: PDF scaricato ma nessuna offerta leggibile dentro"

    return f"{fonte.insegna}: il web ha risposto {risposta.status_code}"


def raccogli_volantini(url_db: str) -> list[str]:
    """Un giro su tutte le insegne. Torna le righe da stampare nei log."""
    base = os.environ.get("URL_WEB_INTERNO")
    segreto = os.environ.get("SEGRETO_INTERNO")

    if not base or not segreto:
        return ["volantini saltati: manca la configurazione"]

    da_guardare: list[FonteVolantino] = []

    with psycopg.connect(url_db, connect_timeout=15) as connessione:
        for fonte in fonti():
            if not gia_fresco(connessione, fonte.insegna):
                da_guardare.append(fonte)

    if not da_guardare:
        return []

    righe: list[str] = []

    with httpx.Client(headers={"user-agent": AGENTE}, follow_redirects=True) as cliente:
        for fonte in da_guardare:
            try:
                indirizzi = pdf_nella_pagina(cliente, fonte.pagina)
            except httpx.HTTPError as errore:
                righe.append(f"{fonte.insegna}: pagina non raggiunta ({errore})")
                continue

            if not indirizzi:
                righe.append(
                    f"{fonte.insegna}: nessun PDF su {fonte.pagina}."
                    " La pagina e' cambiata o il volantino e' solo sfogliabile."
                )
                continue

            preso = False

            # Si provano i primi: il primo link a volte e' un ritaglio o una
            # copertina, e il volantino vero e' subito dopo.
            for indirizzo in indirizzi[:3]:
                try:
                    scaricato = cliente.get(indirizzo, timeout=120)
                    scaricato.raise_for_status()
                except httpx.HTTPError as errore:
                    righe.append(f"{fonte.insegna}: {indirizzo} non scaricato ({errore})")
                    continue

                contenuto = scaricato.content

                if not contenuto.startswith(b"%PDF"):
                    righe.append(f"{fonte.insegna}: {indirizzo} non e' un PDF")
                    continue

                if len(contenuto) > MASSIMO_BYTE:
                    righe.append(
                        f"{fonte.insegna}: {indirizzo} pesa {len(contenuto) // 1024 // 1024} MB, troppo"
                    )
                    continue

                nome = os.path.basename(urlparse(indirizzo).path) or "volantino.pdf"
                righe.append(manda_al_web(cliente, base, segreto, fonte, nome, contenuto))
                preso = True
                break

            if not preso:
                righe.append(f"{fonte.insegna}: nessuno dei PDF trovati era buono")

    return righe
