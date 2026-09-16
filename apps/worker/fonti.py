"""Da dove arrivano le ricette.

Ogni fonte dichiara la sua sitemap e come si riconosce l'indirizzo di una
ricetta vera, distinto da quello di una categoria o di un articolo.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Fonte:
    nome: str
    sitemap: str
    # L'indirizzo e' una ricetta solo se combacia con questo.
    riconosci: re.Pattern[str]


FONTI: list[Fonte] = [
    Fonte(
        nome="giallozafferano.it",
        sitemap="https://www.giallozafferano.it/sitemap.xml",
        riconosci=re.compile(r"^https://(www|ricette)\.giallozafferano\.it/[^/]+\.html$"),
    ),
    Fonte(
        nome="misya.info",
        sitemap="https://www.misya.info/sitemap_index.xml",
        riconosci=re.compile(r"^https://www\.misya\.info/ricetta/[^/]+$"),
    ),
    Fonte(
        nome="fattoincasadabenedetta.it",
        sitemap="https://www.fattoincasadabenedetta.it/sitemap_index.xml",
        riconosci=re.compile(r"^https://www\.fattoincasadabenedetta\.it/ricetta/[^/]+/?$"),
    ),
]
