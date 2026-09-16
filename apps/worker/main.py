"""Punto di ingresso del worker.

Il worker non espone HTTP: legge fonti esterne e scrive su Postgres. Su Railway
gira a cron. In Fase 0 fa solo una cosa, ma la fa in produzione: apre la
connessione al database e lascia un battito, cosi' la home sa che e' vivo.

Da Fase 1 qui dentro arrivano l'import delle ricette e, piu' avanti, la lettura
dei volantini.
"""

from __future__ import annotations

import os
import sys

import psycopg

SERVIZIO = "worker"
MESSAGGIO = "giro completato: nessuna fonte ancora configurata"


def batti(url: str) -> None:
    """Registra un battito. Se le migrazioni non sono ancora passate lo dice e basta."""
    with psycopg.connect(url, connect_timeout=15) as connessione:
        with connessione.cursor() as cursore:
            cursore.execute(
                "insert into battiti (servizio, messaggio) values (%s, %s) returning id, registrato_il",
                (SERVIZIO, MESSAGGIO),
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
        batti(url)
    except psycopg.errors.UndefinedTable:
        print(
            "la tabella battiti non esiste ancora: le migrazioni girano al deploy del web, riprovo al prossimo giro.",
            file=sys.stderr,
            flush=True,
        )
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
