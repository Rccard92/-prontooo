"""Scarica i volantini da solo, una volta a settimana.

Niente upload a mano: il worker va sulla pagina dei volantini di ogni insegna,
trova il PDF e lo passa al web, che e' l'unico posto dove vive il lettore dei
volantini. E' la stessa divisione delle ricette: qui si decide **cosa**
scaricare, di la' si sa **come** leggerlo.

Un volantino dura una settimana, quindi il giro non si fa a ogni ciclo: prima
si guarda in database se per quell'insegna ce n'e' gia' uno fresco. Il ciclo
del worker gira ogni mezz'ora e questa funzione, nel caso normale, costa una
query e basta.

Gli indirizzi delle pagine dei volantini non si indovinano - il primo giro
vero ha risposto 404 su tutti e tre i tentativi - quindi si scoprono: si parte
dalla home dell'insegna, si tengono i link che parlano di volantini, e dentro
quelli si cercano i PDF. E' lo stesso principio del robots.txt per le ricette:
il sito dice dove stanno le sue cose, noi non lo immaginiamo.

Alcune insegne il volantino lo fanno solo sfogliare, e un PDF non c'e'. Quando
succede i log lo dicono con chiarezza invece di tacere, e per quell'insegna
resta il caricamento a mano.
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
    # Da dove partire a cercare: la home, non una pagina indovinata.
    radice: str
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
        FonteVolantino("Lidl", "https://www.lidl.it/"),
        FonteVolantino("Eurospin", "https://www.eurospin.it/"),
        FonteVolantino("MD", "https://www.mdspa.it/"),
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
    r"|bilancio|certificat|allergen|nutrizional|etica|sostenibil|lavora)",
    re.IGNORECASE,
)

# Un link che promette volantini.
PARLA_DI_VOLANTINI = re.compile(r"volantin|flyer|offerte|promozion|catalog", re.IGNORECASE)


def link_ai_volantini(cliente: httpx.Client, pagina: str) -> list[str]:
    """Da una pagina, gli indirizzi che promettono volantini.

    Si guardano gli `href` e il testo intorno: un menu scrive spesso
    `href="/c/s10005610"` con dentro la parola "Volantini", e l'indirizzo da
    solo non direbbe niente.
    """
    risposta = cliente.get(pagina, timeout=30)
    risposta.raise_for_status()

    testo = risposta.text
    candidati: list[str] = []

    # href="..." insieme a quello che c'e' scritto fino alla chiusura del tag.
    for collegamento, etichetta in re.findall(
        r"""href=["']([^"'#]+)["'][^>]*>([^<]{0,80})""", testo, re.IGNORECASE
    ):
        if not PARLA_DI_VOLANTINI.search(collegamento) and not PARLA_DI_VOLANTINI.search(etichetta):
            continue

        intero = urljoin(str(risposta.url), collegamento.replace("&amp;", "&"))

        # Solo dentro casa loro: un link a Facebook non ci serve.
        if urlparse(intero).netloc != urlparse(str(risposta.url)).netloc:
            continue

        if NON_E_UN_VOLANTINO.search(intero):
            continue

        if intero not in candidati:
            candidati.append(intero)

    # Chi dice "volantino" per primo: e' quasi sempre lui.
    candidati.sort(key=lambda u: 0 if re.search(r"volantin", u, re.I) else 1)

    return candidati


# Quante pagine aprire in tutto per un'insegna. Il volantino sta a uno o due
# passi dalla home; oltre si girerebbe per il sito di qualcun altro senza motivo.
PAGINE_PER_INSEGNA = 8


def cerca_il_pdf(cliente: httpx.Client, radice: str) -> tuple[list[str], list[str]]:
    """Scende dalla home finche' non trova dei PDF. Torna (pdf, pagine viste).

    Due passi, non di piu': la home porta alla pagina dei volantini, e quella
    porta al volantino della settimana. Lidl fa esattamente cosi' -
    `/c/volantino-lidl/...` elenca, e dentro ci sono i volantini veri.
    """
    da_vedere = [radice]
    viste: list[str] = []
    pdf: list[str] = []

    while da_vedere and len(viste) < PAGINE_PER_INSEGNA:
        pagina = da_vedere.pop(0)

        if pagina in viste:
            continue

        viste.append(pagina)

        try:
            for indirizzo in pdf_nella_pagina(cliente, pagina):
                if indirizzo not in pdf:
                    pdf.append(indirizzo)
        except httpx.HTTPError:
            continue

        # Tre PDF bastano per capire se c'e' quello giusto.
        if len(pdf) >= 3:
            break

        try:
            for figlio in link_ai_volantini(cliente, pagina):
                if figlio not in viste and figlio not in da_vedere:
                    da_vedere.append(figlio)
        except httpx.HTTPError:
            continue

    return pdf, viste


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


# Indirizzi che possono servire un volantino sfogliabile.
SEMBRA_DATI = re.compile(r"(\.json|/api/|/graphql|leaflet|flyer|volantin|issuu|publitas)", re.I)


def indizi(cliente: httpx.Client, pagina: str, quanti: int = 8) -> list[str]:
    """Gli indirizzi che una pagina di volantino sfogliabile usa per i suoi dati.

    Non serve all'app: serve a me, per capire dove va a prendere le offerte una
    pagina che non offre il PDF. Costa una richiesta e si stampa solo quando il
    PDF non c'e'.
    """
    risposta = cliente.get(pagina, timeout=30)
    risposta.raise_for_status()

    trovati: list[str] = []

    for grezzo in re.findall(r"""["'(](https?://[^"'()\s]{10,200})["')]""", risposta.text):
        if not SEMBRA_DATI.search(grezzo):
            continue

        pulito = grezzo.replace("&amp;", "&")

        if pulito not in trovati:
            trovati.append(pulito)

        if len(trovati) >= quanti:
            break

    return trovati


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
                indirizzi, viste = cerca_il_pdf(cliente, fonte.radice)
            except httpx.HTTPError as errore:
                righe.append(f"{fonte.insegna}: {fonte.radice} non raggiunta ({errore})")
                continue

            righe.append(f"{fonte.insegna}: aperte {len(viste)} pagine, trovati {len(indirizzi)} PDF")

            if not indirizzi:
                righe.append(f"{fonte.insegna}: nessun PDF, il volantino si sfoglia e basta.")

                # Se il PDF non c'e', il volantino sfogliabile i dati li prende
                # da qualche parte. Qui si stampa da dove: e' l'unico modo che
                # ho per capire come arrivarci, visto che quei siti da dove
                # lavoro io non si aprono.
                for pagina in viste[:2]:
                    try:
                        righe.extend(f"{fonte.insegna}: indizio {u}" for u in indizi(cliente, pagina))
                    except httpx.HTTPError:
                        pass

                continue

            preso = False

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
