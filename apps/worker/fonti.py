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


# Pagine che non sono ricette. Le prime due righe vengono dai log del primo
# giro vero: su GialloZafferano le sitemap sono piene di pagine di ricerca, su
# Misya di indici per ingrediente (ricette-acciughe.htm). Sembrano ricette
# dall'indirizzo e non lo sono.
NON_E_UNA_RICETTA = re.compile(
    r"/ricerca-ricette/|/ricette-[a-z0-9-]+\.htm$|"
    r"/(categoria|categorie|category|tag|tags|autore|author|page|pagina|search|ricette-cat"
    r"|feed|wp-content|wp-json|amp|video|news|magazine|speciali|menu|collezioni|glossario"
    r"|dizionario|scuola-di-cucina|come-fare)/|"
    r"\.(jpg|jpeg|png|gif|webp|pdf|xml)$",
    re.IGNORECASE,
)

FONTI: list[Fonte] = [
    # Le ricette di GialloZafferano stanno sul sottodominio, non su www: e'
    # quello il robots.txt che dichiara le sitemap giuste.
    Fonte(
        nome="ricette.giallozafferano.it",
        radice="https://ricette.giallozafferano.it",
        host=("ricette.giallozafferano.it",),
        ripiego=("https://ricette.giallozafferano.it/sitemap.xml",),
    ),
    Fonte(
        nome="blog.giallozafferano.it",
        radice="https://www.giallozafferano.it",
        host=("www.giallozafferano.it",),
        ripiego=(),
    ),
    Fonte(
        nome="misya.info",
        radice="https://www.misya.info",
        host=("www.misya.info",),
        ripiego=("https://www.misya.info/sitemap.xml",),
    ),
    # Fatto in casa da Benedetta risponde 403 a qualsiasi cosa non sia un
    # browser, robots.txt compreso. Resta qui documentata ma disattivata:
    # insistere vorrebbe dire fingersi un browser, e non e' il caso.
    # Fonte(nome="fattoincasadabenedetta.it", ...)
]
