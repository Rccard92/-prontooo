# èProntooo — roadmap operativa

Webapp personale per pianificare i pasti della settimana, generare la lista della spesa e incrociarla con i volantini di Lidl, Eurospin e Conad.

Uso singolo utente, non commerciale. Deploy su Railway.

> Nome: **èProntooo**. Quello che si grida quando la tavola è pronta e bisogna richiamare tutti.

---

## 1. Stack

| Ambito | Scelta | Perché |
|---|---|---|
| Web | Next.js 15 (App Router) + TypeScript | Un solo servizio per UI e API |
| Stile | Tailwind v4 con token CSS custom | Nessuna palette di default |
| DB | Postgres su Railway + pgvector | Serve per il matching semantico offerte |
| ORM | Drizzle | Migrazioni leggibili, niente runtime pesante |
| Worker | Servizio Python separato, stesso repo | `recipe-scrapers` e `PyMuPDF` non hanno equivalenti TS validi |
| Job | Railway cron sul servizio worker | Un giro a settimana per i volantini |
| File | Volume Railway sul worker | I PDF dei volantini, non servono altrove |
| LLM | Anthropic API | Normalizzazione ingredienti + lettura volantini |
| Auth | Cookie con passphrase singola | Utente uno. Non serve altro |

**Due servizi Railway, un Postgres, un repo.** Il worker non espone HTTP pubblico: scrive solo su DB.

---

## 2. Modello dati (nucleo)

Le tabelle che reggono tutto. Il resto si aggiunge dopo.

- `ingredienti_canonici` — l'ingrediente normalizzato (`ricotta`, `farina 00`), con categoria, reparto supermercato, allergeni, stagionalità
- `allergeni` — glutine, lattosio, frutta a guscio, uova, pesce, crostacei, soia, sedano...
- `ricette` — titolo, fonte URL, immagine URL, tempi, porzioni, difficoltà, tipo pasto, testo passaggi
- `ricetta_ingredienti` — riga grezza + quantità + unità + FK a `ingredienti_canonici`
- `profilo` — output del wizard (singola riga)
- `piani` / `piani_pasti` — settimana, giorno, fascia, ricetta, porzioni, stato
- `dispensa` — cosa c'è già in casa
- `insegne` / `volantini` / `offerte` — offerta = nome grezzo + prezzo + validità + embedding
- `offerta_match` — offerta ↔ ingrediente canonico, con punteggio di confidenza

**Regola non negoziabile:** gli allergeni si derivano da `ingredienti_canonici`, mai dai tag della fonte. Un sito che scrive "senza glutine" non è una fonte attendibile.

---

## 3. Fasi

### Fase 0 — Fondamenta

Prima di scrivere una riga di logica: repo su GitHub, due servizi su Railway, Postgres collegato, deploy automatico su push, una pagina che risponde in produzione.

Deliverable: `CLAUDE.md` nel repo con stack, convenzioni e regole di design, così ogni sessione parte allineata.

*Fatto quando:* push su `main` → produzione aggiornata, senza intervento manuale.

---

### Fase 1 — Catalogo ricette

Il pezzo che sblocca tutto il resto.

- Parser JSON-LD `schema.org/Recipe` via `recipe-scrapers`
- Endpoint "importa da URL": incolli un link, la ricetta entra nel catalogo
- Pipeline di normalizzazione: ogni riga ingrediente passa una volta all'LLM e diventa quantità + unità + ingrediente canonico + allergeni
- Seed: crawl delle sitemap di 2-3 siti fidati, 300-500 ricette importate in batch
- Schermata catalogo con ricerca e filtri

*Fatto quando:* 300+ ricette in DB con ingredienti canonici mappati, e l'import da URL funziona in meno di 5 secondi.

**Attenzione agli allergeni nascosti.** Il mapping ingrediente → allergene va curato a mano per i casi sporchi: salsa di soia e dado contengono glutine, il pesto contiene latte e frutta a guscio, molti insaccati contengono lattosio. Questa tabella è il cuore della correttezza dell'app.

---

### Fase 2 — Wizard di configurazione

Il wizard gira una volta e resta modificabile. Cosa chiede:

**Chi mangia**
- Quante persone, e se ci sono bambini (le porzioni si scalano)
- Porzioni di default per pasto

**Cosa evitare**
- Allergie e intolleranze (esclusione rigida, mai aggirabile)
- Esclusioni scelte (no pane, no maiale, no carne rossa) — morbide, il sistema può proporre alternative
- Lista nera ingredienti (il singolo ingrediente che non ti piace)

**Come mangi**
- Quali pasti pianificare davvero: colazione, spuntino, pranzo, merenda, cena
- Quali giorni sei fuori a pranzo (quei pasti non entrano nel piano né nella lista)
- Tempo massimo per fascia (colazione 10 minuti, cena 45)
- Difficoltà massima accettata

**Come cucini**
- Attrezzatura: forno, friggitrice ad aria, pentola a pressione, planetaria — filtra le ricette che non puoi fare
- Cucine preferite
- Quanto ti va di ripetere: ogni quante settimane una ricetta può tornare

**Dove compri**
- Insegne di fiducia e punto vendita specifico
- Budget settimanale indicativo

**Stile alimentare**
- Preferenza generale (equilibrato, più verdure, più proteine, più leggero la sera)
- Nessun target calorico: l'app riepiloga, non prescrive

*Fatto quando:* il profilo salvato cambia concretamente quali ricette il sistema propone.

---

### Fase 3 — Piano settimanale

- Griglia 7 giorni × fasce attive
- Generazione automatica del piano rispettando profilo, varietà e anti-ripetizione
- **Blocca e rigenera**: fissi i pasti che ti piacciono e rigeneri solo il resto
- Sostituzione singolo pasto con alternative coerenti
- Drag and drop per spostare un pasto di giorno
- Salvataggio piano, storico dei piani passati

**Funzione da non saltare: gli avanzi.** Se una ricetta rende 4 porzioni e siete in 2, il sistema propone il riuso il giorno dopo invece di farti cucinare due volte. Cambia radicalmente l'utilità reale dell'app.

*Fatto quando:* premi un pulsante e ottieni una settimana sensata che rispetta tutte le esclusioni.

---

### Fase 4 — Lista della spesa

- **Derivata dal piano, non salvata come entità.** Così l'aggiornamento automatico è gratis per costruzione: cambi una ricetta, la lista cambia da sola
- Aggregazione per ingrediente canonico con conversione unità (200 g + 1 barattolo + q.b.)
- **Raggruppamento per reparto** (ortofrutta, banco frigo, dispensa, surgelati) — segue il percorso fisico nel supermercato
- Dispensa: quello che hai già in casa viene sottratto dalla lista
- Spunta degli articoli mentre fai la spesa, con stato persistente
- Aggiunta manuale di voci fuori piano
- Export testo per condividerla

*Fatto quando:* la usi al supermercato dal telefono e non ti serve altro.

---

### Fase 5 — Volantini e offerte

Il pezzo più fragile. Si costruisce in due tempi.

**5a — Caricamento manuale**
- Carichi il PDF del volantino, il sistema lo parsifica
- Estrazione testo con PyMuPDF; le pagine senza testo selezionabile vanno all'LLM in vision
- Ogni offerta diventa: nome grezzo, marca, formato, prezzo, prezzo al kg/l, validità
- Matching contro la lista della spesa con embedding pgvector + soglia di confidenza
- Le corrispondenze incerte si mostrano come "da verificare", mai come certe

**5b — Raccolta automatica**
- Cron settimanale che scarica i PDF di Lidl ed Eurospin (testo selezionabile, estrazione diretta)
- Conad per ultimo: è una cooperativa, il volantino cambia per cooperativa regionale e punto vendita. Va agganciato il punto vendita siciliano corretto, altrimenti i prezzi mostrati non sono quelli che paghi

Vista finale: la lista della spesa divisa per insegna, con quanto risparmi e cosa conviene comprare dove.

*Fatto quando:* apri l'app il sabato e sai in quale dei tre supermercati andare e per cosa.

---

### Fase 6 — Uso reale

Le cose che fanno la differenza tra un progetto e uno strumento che usi davvero.

- **PWA installabile** — la apri dal telefono al supermercato come un'app vera, funziona offline sulla lista
- **Modalità cucina** — schermo sempre acceso, un passaggio alla volta, timer integrati sui tempi di cottura
- Preferiti e voto ricetta, che retroagiscono sul suggeritore
- Note personali per ricetta ("io ci metto meno sale")
- Riepilogo nutrizionale settimanale, informativo

---

### Fase 7 — Intelligenza

- **Piano a partire dalle offerte** — inverti il flusso: il sistema guarda cosa è in promozione questa settimana e costruisce il piano intorno a quello. È la funzione con più valore pratico di tutto il progetto
- Filtro stagionalità su frutta e verdura per mese
- Costo stimato della settimana e confronto con le settimane precedenti
- Suggerimenti basati sullo storico: cosa cucini davvero contro cosa pianifichi

---

## 4. Fuori scope in v1

Da non costruire, per non affondare: multi-utente, ruoli e permessi, app native, integrazione con la spesa online, riconoscimento foto dei piatti, condivisione social, tracking peso.

---

## 5. Design

Il brief è esplicito: niente estetica generata. Due direzioni, ne va scelta una e portata fino in fondo.

### Direzione A — Etichetta d'agrumi *(consigliata)*

L'immaginario delle etichette litografiche delle cassette di agrumi siciliani: colore pieno e saturo, cornici decorative, tipografia da manifesto, niente pastello.

```
Inchiostro    #14213D   fondo profondo, testo
Cobalto       #1B4BA8   superfici, sezioni
Zagara        #F2C230   accento primario, prezzi, azioni
Foglia        #2E6B3E   conferme, stagionalità
Carta         #FAF6EC   fondo chiaro, non crema pubblicitaria
Rosso sangue  #C3352B   scadenze, allergeni, avvisi
```

- **Display:** Yeseva One — grazie ornate, contrasto alto, vive bene grande
- **Testo e UI:** Archivo — grottesca con larghezze variabili, cifre tabulari per i prezzi
- Il colore pieno è la struttura, non la decorazione: intere sezioni su fondo cobalto, la card ricetta è un'etichetta, non un rettangolo bianco con bordo grigio
- Le foto delle ricette vanno grandi ed edge-to-edge, mai francobolli in una griglia

### Direzione B — Banco del mercato

Il linguaggio dei cartelli dei prezzi scritti a mano: cartone, giallo etichetta, cifre enormi e stencil, materialità tattile. Più ruvida, più divertente, meno adatta ai testi lunghi delle ricette.

### Regole anti-genericità

Valgono qualunque direzione si scelga.

- **Vietato Inter.** È il font di default di ogni interfaccia generata
- Niente card tutte uguali: bordo grigio 1px, `rounded-lg`, `shadow-sm` ripetuti ovunque
- Niente palette `slate` / `zinc` / `gray` di Tailwind: solo i token qui sopra
- Niente etichette in maiuscoletto spaziato sopra ogni titolo
- Niente gradiente viola, niente emoji usate come icone
- Niente `→` appiccicato al testo dei pulsanti
- Scala tipografica ampia: forte stacco tra titolo e corpo, non tutto a 14px grigio
- Una sola animazione orchestrata in tutta l'app, non transizioni hover su ogni elemento

### Librerie da usare

Non il kit shadcn di default.

- **Base UI** o **Radix primitives**, vestiti a mano
- **Motion** per l'unico momento animato
- **Embla** per lo scorrimento delle card ricetta
- **Phosphor Icons** — Lucide è l'icon set di default di shadcn, si riconosce
- **Vaul** per i pannelli dal basso su mobile
- **NumberFlow** per prezzi e porzioni che cambiano

### Metodo

Prima di scrivere CSS: piano di design compatto (token colore, ruoli tipografici, concetto di layout, principi), poi revisione contro il brief. Se un pezzo del piano è quello che verrebbe fuori per qualsiasi altra app di ricette, va rifatto.

---

## 6. Ordine di lavoro

```
Fase 0  Fondamenta e deploy       →  mezza giornata
Fase 1  Catalogo ricette          →  il pezzo più lungo, non affrettarlo
Fase 2  Wizard                    →  veloce, ma definisce tutto il resto
Fase 3  Piano settimanale
Fase 4  Lista della spesa         →  qui l'app diventa usabile davvero
Fase 5a Volantini manuali         →  verifica che il matching funzioni
Fase 5b Raccolta automatica       →  solo se 5a ha dato buoni risultati
Fase 6  PWA e modalità cucina
Fase 7  Piano dalle offerte
```

La regola: ogni fase finisce in produzione e funzionante prima che inizi la successiva. Niente tre fasi aperte insieme.
