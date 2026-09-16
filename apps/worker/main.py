"""Punto di ingresso del worker.

Il worker non espone HTTP: legge fonti esterne e scrive su Postgres. Su Railway
gira a cron. Quello che fa, in ordine:

1. riempie il catalogo raccogliendo ricette dalle sitemap delle fonti
2. lascia un battito, cosi' la pagina di stato sa che e' vivo

I volantini dei supermercati arrivano in Fase 5 e si agganciano qui.
"""

from __future__ import annotations

import os
import sys

import psycopg

from raccolta import raccogli

SERVIZIO = "worker"


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


def main() -> int:
    url = os.environ.get("DATABASE_URL")

    if not url:
        print("DATABASE_URL non impostata: il worker non sa a quale database parlare.", file=sys.stderr)
        return 1

    try:
        importate = raccogli(url)
        messaggio = f"raccolta ricette: {importate} nuove in catalogo"
    except psycopg.errors.UndefinedTable:
        print(
            "le tabelle non esistono ancora: le migrazioni girano al deploy del web, riprovo al prossimo giro.",
            file=sys.stderr,
            flush=True,
        )
        return 0
    except Exception as errore:  # la raccolta non deve impedire il battito
        print(f"raccolta fallita: {errore}", file=sys.stderr, flush=True)
        messaggio = f"raccolta fallita: {errore}"

    try:
        batti(url, messaggio)
    except psycopg.errors.UndefinedTable:
        print("la tabella battiti non esiste ancora, riprovo al prossimo giro.", file=sys.stderr)
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
