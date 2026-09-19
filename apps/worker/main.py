"""Punto di ingresso del worker.

Il worker non espone HTTP: legge fonti esterne e scrive su Postgres. A ogni
giro fa due cose:

1. riempie il catalogo raccogliendo ricette dalle sitemap delle fonti
2. fa leggere al web un blocco di ricette non ancora normalizzate
3. scarica i volantini delle insegne, quando quelli in casa sono vecchi
4. bussa alla rotta dei promemoria del web, che decide se ne va mandato uno
5. lascia un battito, cosi' la pagina di stato sa che e' vivo

Poi dorme e ricomincia. Il ciclo sta qui dentro invece che nel cron di Railway
di proposito: un servizio a cron con restart NEVER viene creato ma non avviato
finche' non scatta l'orario, e quando l'orario e' l'unica leva non c'e' modo di
far partire un giro adesso. Un processo che dorme si avvia al deploy, si vede
nei log e si puo' forzare con un redeploy.

Quando il catalogo e' pieno il giro costa quasi niente: un conteggio sul
database, una query sui volantini e via. Non ci sono altri servizi e non ci
sono cron: un processo solo che dorme, e fa tutto lui.
"""

from __future__ import annotations

import os
import sys
import time

import psycopg

from normalizza import bussa as normalizza_un_blocco
from promemoria import bussa
from raccolta import raccogli
from volantini import raccogli_volantini

SERVIZIO = "worker"

# Quanto dorme fra un giro e l'altro.
INTERVALLO = int(os.environ.get("INTERVALLO_SECONDI", "1800"))


def batti(url: str, messaggio: str) -> None:
    """Registra un battito. Se le migrazioni non sono ancora passate lo dice e basta."""
    with psycopg.connect(url, connect_timeout=15) as connessione:
        with connessione.cursor() as cursore:
            cursore.execute(
                "insert into battiti (servizio, messaggio) values (%s, %s) returning id, registrato_il",
                (SERVIZIO, messaggio),
            )
            riga = cursore.fetchone()

    if riga is None:
        raise RuntimeError("insert del battito non ha restituito nulla")

    identificativo, istante = riga
    print(f"battito {identificativo} registrato alle {istante.isoformat()}", flush=True)


def un_giro(url: str) -> None:
    try:
        importate = raccogli(url)
        messaggio = f"raccolta ricette: {importate} nuove in catalogo"
    except psycopg.errors.UndefinedTable:
        print(
            "le tabelle non esistono ancora: le migrazioni girano al deploy del web, riprovo al prossimo giro.",
            file=sys.stderr,
            flush=True,
        )
        return
    except Exception as errore:  # la raccolta non deve impedire il battito
        print(f"raccolta fallita: {errore}", file=sys.stderr, flush=True)
        messaggio = f"raccolta fallita: {errore}"

    # La normalizzazione non deve far cadere il giro: senza la chiave non
    # parte, e il catalogo resta sfogliabile com'era.
    try:
        print(normalizza_un_blocco(), flush=True)
    except Exception as errore:
        print(f"normalizzazione fallita: {errore}", file=sys.stderr, flush=True)

    # I volantini costano una query quando in casa ce n'e' gia' uno fresco.
    try:
        for riga in raccogli_volantini(url):
            print(f"volantini | {riga}", flush=True)
    except Exception as errore:
        print(f"raccolta volantini fallita: {errore}", file=sys.stderr, flush=True)

    # I promemoria non devono far cadere il giro: sono un di piu'.
    try:
        print(bussa(), flush=True)
    except Exception as errore:
        print(f"promemoria falliti: {errore}", file=sys.stderr, flush=True)

    try:
        batti(url, messaggio)
    except psycopg.errors.UndefinedTable:
        print("la tabella battiti non esiste ancora, riprovo al prossimo giro.", file=sys.stderr)


def main() -> int:
    url = os.environ.get("DATABASE_URL")

    if not url:
        print("DATABASE_URL non impostata: il worker non sa a quale database parlare.", file=sys.stderr)
        return 1

    print(f"worker avviato, un giro ogni {INTERVALLO} secondi", flush=True)

    while True:
        un_giro(url)
        print(f"dormo {INTERVALLO} secondi", flush=True)
        time.sleep(INTERVALLO)


if __name__ == "__main__":
    raise SystemExit(main())
