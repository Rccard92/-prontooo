"""Da dove arrivano le ricette.

Di ogni fonte sappiamo il dominio e come si riconosce una pagina che *non* e'
una ricetta. Gli indirizzi delle sitemap non si indovinano: si leggono dal
robots.txt, che e' il posto dove i siti li dichiarano. Cosi' quando un sito
riorganizza le sue sitemap noi non ce ne accorgiamo nemmeno.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Fonte:
    nome: str
    # Da dove partire per leggere il robots.txt.
    radice: str
    # Gli host che consideriamo di questa fonte (GialloZafferano usa un
    # sottodominio diverso per le ricette).
    host: tuple[str, ...]
    # Sitemap da provare se il robots.txt non ne dichiara.
    ripiego: tuple[str, ...] = ()


# Pagine che non sono ricette: categorie, tag, elenchi, allegati.
NON_E_UNA_RICETTA = re.compile(
    r"/(categoria|categorie|category|tag|tags|autore|author|page|pagina|search|ricette-cat"
    r"|feed|wp-content|wp-json|amp|video|news|magazine|speciali|menu|collezioni)/|"
    r"\.(jpg|jpeg|png|gif|webp|pdf|xml)$",
    re.IGNORECASE,
)

FONTI: list[Fonte] = [
    Fonte(
        nome="giallozafferano.it",
        radice="https://www.giallozafferano.it",
        host=("www.giallozafferano.it", "ricette.giallozafferano.it"),
        ripiego=("https://www.giallozafferano.it/sitemap-index.xml",),
    ),
    Fonte(
        nome="misya.info",
        radice="https://www.misya.info",
        host=("www.misya.info",),
        ripiego=("https://www.misya.info/sitemap.xml",),
    ),
    Fonte(
        nome="fattoincasadabenedetta.it",
        radice="https://www.fattoincasadabenedetta.it",
        host=("www.fattoincasadabenedetta.it",),
        ripiego=("https://www.fattoincasadabenedetta.it/sitemap.xml",),
    ),
]
