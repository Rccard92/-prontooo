# èProntooo — roadmap

**Ti dà le ricette da fare, usando solo gli ingredienti che hai deciso tu.** Quella lista la
riempi in due modi, a scelta: carichi il PDF del nutrizionista, oppure te la componi da solo
nell'app. Andare dal nutrizionista non è un requisito.

Non è un ricettario con sopra un calendario, e non è un'app da dietologo. È il pezzo in mezzo:
da un elenco di ingredienti con i pesi tira fuori **cosa cucinare**, giorno per giorno.

> Questo file è la fonte di verità. Esiste anche come documento leggibile:
> <https://claude.ai/code/artifact/f9a1fedb-6d4f-4237-9a51-7ba7c53141ef>

---

## 1. I quattro momenti che devono funzionare

Se funzionano questi, l'app è fatta. Tutto il resto sta intorno.

1. **Dici quali ingredienti puoi usare.** Carichi il PDF e in dieci secondi è dentro, oppure
   li spunti tu dal vocabolario. Da entrambe le strade esce la stessa cosa: cosa puoi mangiare
   a colazione, a pranzo, a cena, e in che quantità. Modificabile sempre.
2. **Apri la giornata e vedi le card.** Una per pasto, con la ricetta, la foto, i grammi e il
   tempo. Se una non ti va la cambi, e quella nuova sta dentro gli stessi ingredienti.
3. **Hai mangiato una pizza a pranzo e lo scrivi.** L'app ricalcola la cena e ti dice di
   quanto sei sopra, senza farti la predica e senza farti recuperare domani.
4. **Sabato apri la lista della spesa**, divisa per reparto, con accanto cosa è in offerta e dove.

E se dal nutrizionista ci vai: prima della visita, il resoconto di cosa hai mangiato davvero
contro cosa era previsto. È un di più, non il centro.

---

## 2. Dove siamo

Tutte e sette le fasi sono in produzione. Push su `main` ricostruisce e sostituisce il deploy da
solo, le migrazioni girano prima di ogni rilascio, e se falliscono resta in piedi la versione
precedente.

| Pezzo | Stato |
|---|---|
| Repo, Railway, Postgres, deploy automatico | Finito |
| Catalogo ricette che si riempie da solo dalle sitemap | Funziona |
| Vocabolario di 189 alimenti con ruoli, fasce, etichette e valori CREA | Funziona |
| La tua lista di ingredienti: PDF del nutrizionista **o** spunta per categorie | Funziona |
| Giornata ON / OFF, registro dei consumi, ricalibrazione | Funziona |
| Lista della spesa derivata, dispensa, reparti | Funziona |
| Ricettario per componenti e modalità cucina | Funziona |
| Offerte con soglia di confidenza, dove conviene andare | Funziona |
| Volantini scaricati dal worker da solo | Trova le pagine; il PDF dipende dall'insegna |
| PWA installabile, offline, promemoria push | Funziona, da provare sul telefono |
| Storico, peso, resoconto per la visita | Funziona |
| Sostituzioni equivalenti, scelta che impara e guarda le offerte | Funziona |
| Login multiutente: ognuno il suo pannello | Funziona |

Manca soltanto quello che ha bisogno della chiave Anthropic: la **normalizzazione degli
ingredienti delle ricette del catalogo**, e quindi gli allergeni sulle ricette. Tutto il resto
gira senza chiave, per scelta.

Sui volantini la raccolta automatica trova le pagine giuste da sola, partendo dalla home. Quello
che trova dentro dipende dall'insegna: chi pubblica un PDF si legge, chi fa solo sfogliare no, e
per quelli resta il caricamento a mano finche' non trovo la strada dei loro dati.

Restano due prove che da qui non posso fare: i promemoria su un telefono vero e l'app installata.

---

## 3. Il modello dati

Tre gruppi: il vocabolario, il piano, la realtà. Il piano è quello che dovresti mangiare, la
realtà è quello che hai mangiato, e la differenza fra i due è il prodotto.

### Vocabolario

| Tabella | Cosa tiene | Stato |
|---|---|---|
| `alimenti` | Nome, gruppo, ruoli, fasce, porzione tipica, etichette | Esiste |
| `alimenti` → macro | kcal, proteine, carboidrati, grassi, fibre per 100g | Da aggiungere |
| `alimenti` → spesa | Reparto del supermercato, mesi di stagione | Da aggiungere |
| `alimento_equivalenze` | Quali alimenti si scambiano a parità di ruolo | Nuova |

### Piano

| Tabella | Cosa tiene |
|---|---|
| `piani_nutrizionali` | Nome, data visita, origine (pdf/manuale), se è attivo |
| `piano_giorni` | Un giorno-tipo: `on`, `off`, o un giorno della settimana |
| `piano_pasti` | Un pasto di quel giorno-tipo: fascia e ordine |
| `piano_componenti` | Una riga del pasto — un ruolo da riempire |
| `piano_opzioni` | Le alternative di quella riga, con quantità e unità |

`piano_opzioni` tiene sia l'alimento riconosciuto sia il **testo grezzo** letto dal PDF. Quando
l'import non riconosce una voce non la butta: la mostra com'era e l'utente la collega a mano.

### Realtà

| Tabella | Cosa tiene |
|---|---|
| `giornate` | Data, tipo di giorno, obiettivo del giorno in kcal e macro |
| `giornata_pasti` | Per fascia: previsto, consumato, stato |
| `dispensa` | Cosa c'è in casa, quantità e scadenza |
| `lista_spuntati` | Cosa è già nel carrello, per settimana |
| `pesi` | Data e chilogrammi, se si traccia |

L'obiettivo del giorno si **fotografa** dentro `giornate` invece di ricalcolarlo: cambiando il
piano, lo storico deve restare confrontabile con quello che valeva allora.

### Cosa si butta

Le tabelle `piani` e `piani_pasti` settimanali spariscono. Una settimana è sette `giornate`,
non un'entità a sé: tenerle entrambe vorrebbe dire due verità sullo stesso giorno.

---

## 4. Fase 1 — La tua lista di ingredienti

Comanda tutte le altre: le ricette, i grammi, la spesa e la ricalibrazione nascono da qui.

La lista si riempie in **due modi, e portano alla stessa struttura** — per ogni fascia, righe di
alternative con le quantità:

```
Carichi il PDF del nutrizionista  ┐
                                  ├─→  La tua lista di ingredienti  ─→  Le ricette del giorno
Oppure li scegli tu nell'app      ┘                                     usano solo questi
```

La strada manuale esiste già a metà: il vocabolario di 124 alimenti e la schermata dove li
spunti sono in produzione. Le manca di diventare una lista per fascia con le quantità, invece
che una spunta piatta.

### 1.1 Numeri sugli alimenti

kcal, proteine, carboidrati, grassi, fibre per 100g, più reparto e mesi di stagione, su tutti i
124 alimenti. Valori dalle tabelle CREA: pubblici e **indicativi**, servono a stimare non a
certificare, e l'app lo dice dove serve. Nessuna chiave API.

*Fatto quando:* ogni pasto composto mostra il suo conto in kcal e macro.

### 1.2 Import del PDF — la prima strada

Estrazione del testo, riconoscimento della struttura (giorno → fascia → righe con alternative
separate da "o"), aggancio nome → alimento in tre passaggi: esatto, approssimato, e il resto lo
collega l'utente una volta sola.

**La schermata di conferma non si salta mai.** Un import che sbaglia in silenzio è peggio di uno
che non funziona.

PDF scansionati senza testo selezionabile: serve la lettura in vision, quindi la chiave. Rimandato.

*Fatto quando:* carichi una dieta e dopo la conferma la ritrovi tutta dentro l'app.

### 1.3 La sezione digitale — la seconda strada, e dove finisce anche la prima

Una schermata per fascia. Per ogni riga, le alternative con i grammi. Si può: cambiare una
quantità, togliere un'alternativa, aggiungerne una propria, aggiungere o togliere una riga,
disattivare una fascia.

Le modifiche sopravvivono a un reimport: caricando la dieta nuova si mostra il **diff**, non si
sovrascrive.

*Fatto quando:* modifichi una quantità e la ritrovi il giorno dopo nel piano del giorno.

### 1.4 Giorno ON / giorno OFF

Due giorni-tipo. Nel profilo si dicono i giorni di allenamento, modificabili al volo.

| | ON | OFF |
|---|---|---|
| Base | Piena | Ridotta |
| Proteina | Uguale | Uguale |
| Verdura | Uguale | Aumentata |
| Grassi aggiunti | Ridotti | Pieni |

Se il nutrizionista ha dato due schemi distinti si usano i suoi. Se ne ha dato uno, ON e OFF
nascono da quello con i moltiplicatori sopra, e restano modificabili.

*Fatto quando:* lo stesso giorno propone due pasti diversi a seconda che ci si alleni o no.

### 1.5 Passphrase

Cookie e una passphrase. Non è una funzione, è che dalla Fase 1 dentro c'è il piano alimentare
e cosa si mangia ogni giorno. **Va fatta in questa fase, non dopo.**

---

## 5. Fase 2 — La giornata

### 2.1 Oggi mangi questo

La home diventa il giorno. In cima data e tipo di giorno con interruttore; sotto **una card per
pasto**: foto, nome della ricetta, i grammi dei componenti, il tempo. I pasti passati sbiaditi,
il prossimo in evidenza.

Forma confermata della schermata principale. Su ogni card due gesti soli: **cambia** (ne arriva
un'altra dentro gli stessi ingredienti) e **tieni ferma**.

### 2.2 Il registro

| Modo | Quando | Costo |
|---|---|---|
| Spunta | Hai mangiato il previsto | Un tocco |
| Correggi | Stessa roba, quantità o alternativa diverse | Due tocchi |
| Scrivi | Eri fuori | Una frase |

Il terzo caso decide se l'app la usi o la abbandoni. Stimare un pasto scritto a parole richiede
la chiave; senza, resta un elenco di piatti comuni già pesati, scritto a mano.

### 2.3 La ricalibrazione

Obiettivo del giorno meno quanto già consumato; il residuo si ridistribuisce sui pasti che
mancano mantenendo i ruoli e scalando le quantità.

1. **Non si scende sotto il minimo.** Ogni fascia ha un pavimento: una cena da 200 kcal non è una cena.
2. **Non si recupera il giorno dopo.** Domani riparte dall'obiettivo pieno.
3. **Si ricalibra la quantità, non la struttura.** Cambiano i grammi, non il tipo di pasto.
4. **Le proteine si difendono per ultime.** Prima i grassi aggiunti, poi la base, infine la proteina.

Tono: "oggi sei a +340 kcal", mai "hai sgarrato".

*Fatto quando:* mangi una pizza a pranzo e la cena che ti propone ha senso.

### 2.4 Riepilogo del giorno

Consumato contro obiettivo, in kcal e nei tre macro. Una barra per ognuno. Nessun voto.

---

## 6. Fase 3 — La settimana e la spesa

Sette giornate generate dal piano, con i giorni di allenamento al posto giusto. Si genera il
giovedì per la settimana dopo, così la spesa si fa col piano in mano.

La lista della spesa è **derivata, non salvata**: somma per alimento, meno la dispensa,
arrotondata al formato di vendita, raggruppata per reparto nell'ordine in cui si cammina.
Spunta persistente, voci fuori piano ammesse.

La dispensa si aggiorna in due punti: entra quando spunti la spesa, esce quando registri un
pasto. Non diventa mai un inventario perfetto, e non deve.

*Fatto quando:* la usi al supermercato dal telefono e non ti serve altro.

---

## 7. Fase 4 — Le ricette

**È la fase che dà il prodotto vero**: ricette vincolate agli ingredienti scelti. Le Fasi 1 e 2
costruiscono il vincolo, questa lo trasforma in cose da cucinare.

### Da dove arrivano le ricette — decisione aperta

| Modo | Come funziona | Chiave | Il problema |
|---|---|---|---|
| Filtrare il catalogo | Si tengono le ricette raccolte che usano solo i tuoi ingredienti | Sì | Poche sopravvivono: quasi ogni ricetta vera ha dentro qualcosa fuori lista |
| Generarle | Dai componenti si genera la ricetta, scritta sui tuoi grammi | Sì | ~2 centesimi a ricetta, una volta sola perché si salva |
| Ricettario curato | Un centinaio di ricette scritte per componenti, dentro l'app | No | Varietà limitata, ma funziona subito e a costo zero |

**Proposta: il misto.** Catalogo quando una ricetta vera calza, generazione quando non calza
niente, ricettario curato come rete quando non c'è la chiave. Così l'app funziona anche senza
chiave, e con la chiave diventa quella giusta.

**4.1 Normalizzazione** (serve la chiave). Ogni riga ingrediente passa una volta all'LLM e
diventa quantità + unità + alimento canonico. Il risultato si salva e non si rifà mai. Da qui:
allergeni sulle ricette, reparto per la spesa, match ricetta ↔ componenti.

**4.2 Compatibilità a livelli**, non sì/no: *calza* (usa quei componenti), *vicina* (stessi
ruoli, alimenti equivalenti), *adattabile* (ci arrivi togliendo o sostituendo, e l'app dice cosa).

**4.3 Quantità adattate** ai grammi del pasto, non a quelle della ricetta.

**4.4 Modalità cucina**: schermo acceso, un passaggio alla volta, timer.

---

## 8. Fase 5 — Volantini e offerte

Il pezzo più fragile, in due tempi.

**5.1 Manuale.** PDF caricato a mano, PyMuPDF per il testo, vision per le pagine senza.
Ogni offerta: nome grezzo, marca, formato, prezzo, prezzo al kg/l, validità.

**5.2 Match** con embedding pgvector e soglia di confidenza. Sotto soglia si mostra
**da verificare**, mai come certo.

**5.3 Automatico.** Cron settimanale per Lidl ed Eurospin. Conad per ultimo: è una cooperativa,
il volantino cambia per cooperativa regionale e punto vendita, e va agganciato quello siciliano
giusto o i prezzi mostrati non sono quelli che paghi.

**5.4 La vista che serve:** la lista divisa per insegna, quanto risparmi, se vale due tappe.

---

## 9. Fase 6 — Uso reale

PWA installabile che funziona offline su lista e giornata (al supermercato sottoterra il
telefono non prende, ed è quando serve). Due promemoria soli: la sera se non hai registrato,
il giovedì per generare la settimana. Storico consultabile.

---

## 10. Fase 7 — Intelligenza

**7.1 Il resoconto per la visita.** Un PDF: quanto hai seguito il piano per fascia e settimana,
dove sistematicamente no, cosa hai mangiato al posto di cosa, l'andamento del peso. È la
funzione con più valore pratico di tutte.

**7.2 Sostituzioni equivalenti.** 150g di pollo diventano 180g di merluzzo, non 150g.

**7.3 Impara cosa mangi davvero.** Dopo due mesi di registro le proposte si spostano su quello
che scegli sempre.

**7.4 Il piano che parte dalle offerte.** Si inverte il flusso, restando dentro il piano.

**7.5 Peso e misure.** Era fuori scope quando l'app era un ricettario; col resoconto per il
nutrizionista dentro, senza peso quel resoconto è monco. Decisione dell'utente.

---

## 11. Le regole che non si violano

- **L'app non è un medico.** Non inventa diete, non stabilisce fabbisogni, non dà consigli
  nutrizionali. Riorganizza porzioni di alimenti già prescritti dal nutrizionista dell'utente.
  Dove stima, lo dice
- **Non si recupera il giorno dopo.** Nessuna compensazione fra giorni
- **Gli allergeni si derivano dagli alimenti, mai dai tag della fonte.** Finché le ricette non
  sono normalizzate, l'app dichiara di non conoscerne gli allergeni invece di tacere
- **Un import non sovrascrive mai in silenzio.** Dieta o volantino: sempre una conferma
- **Sotto soglia si dice "da verificare".** Vale per le offerte e per la stima di un pasto scritto
- **I dati sul cibo sono dati personali.** Dietro passphrase, e non escono dal database

---

## 12. Fuori scope

Multiutente, ruoli e permessi, app native, integrazione con la spesa online, riconoscimento
delle foto dei piatti, condivisione social.

---

## 13. Ordine di lavoro

```
Fase 1  Il piano è tuo        →  fatta
Fase 2  La giornata           →  fatta
Fase 3  Settimana e spesa     →  fatta
Fase 4  Ricette al servizio   →  fatta col ricettario, senza chiave
Fase 5  Volantini e offerte   →  fatta a mano; la raccolta automatica no
Fase 6  Uso reale             →  fatta
Fase 7  Resoconto e ingegno   →  fatta

Resta fuori, e sta scritto dove: la normalizzazione delle ricette del catalogo (serve
ANTHROPIC_API_KEY) e la raccolta automatica dei volantini (gli indirizzi cambiano ogni
settimana, e un raccoglitore che non si può provare è peggio di nessun raccoglitore).
```

Una fase finisce **in produzione e funzionante** prima che cominci la successiva.
Niente tre fasi aperte insieme.
