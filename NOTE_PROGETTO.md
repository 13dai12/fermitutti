# Note di progetto

Questo file è la memoria del progetto. Contiene una voce per ogni decisione o lezione, sempre con il perché. Va letto all'inizio di ogni sessione di lavoro. Le voci esistenti si aggiornano: non si duplicano.

Ultimo aggiornamento: 11 novembre 2026.

## Fonte dei dati

### Feed RSS del Ministero come fonte principale
- **Decisione:** si legge `https://scioperi.mit.gov.it/mit2/public/scioperi/rss`. È l'indirizzo usato anche dall'integrazione per Home Assistant `sappadev/scioperi-italia` (file `const.py`) ed è linkato dalla pagina ufficiale del calendario («Abbonatevi al nuovo RSS Scioperi»).
- **Perché:** è leggero (circa 25 KB contro 315 KB della pagina HTML), stabile e pensato per essere letto in automatico.
- **Struttura reale** (verificata il 10 e l'11 novembre 2026): un `<item>` per sciopero.
  - Nel titolo ci sono data di inizio, settore, rilevanza, regione e provincia, separati da ` - `.
  - Nella descrizione (CDATA) ci sono righe `Chiave: valore` separate da `<br/>`: modalità, data fine, settore, rilevanza, regione, provincia, sindacati, categoria interessata, data proclamazione, data ricezione.
  - Il `guid` è `http://scioperi.mit.gov.it/<numero>`.
  - Il canale dichiara «aggiornato alla data: GG/MM/AAAA».
- **Valori visti:**
  - settori: Aereo, Ferroviario, Trasporto pubblico locale, Trasporto merci, Generale, Plurisettoriale, Taxi; la legenda ufficiale aggiunge Appalti ferroviari, Marittimo, Elicotteri, Ncc, Circolazione e sicurezza stradale;
  - rilevanze: Nazionale, Interregionale, Regionale, Territoriale, Provinciale, Locale, Aziendale, Da definire;
  - per gli scioperi nazionali, `Regione: Italia` e `Provincia: Tutte`.

### Il Ministero non segnala revoche né rinvii
- **Lezione:** nel feed e nella pagina non esiste un campo «stato». Ho cercato «revoc», «differ», «sospes» e «annull»: zero risultati. Uno sciopero revocato semplicemente sparisce.
- **Decisione** (`scripts/lib/archivio.mjs`): si conserva un archivio e si deducono gli stati.
  - Sparito prima dei suoi giorni: **revocato**.
  - Sparito durante i suoi giorni: **tolto dal calendario**.
  - Sparito dopo: **concluso**.
  - Data cambiata sullo stesso codice: **rinviato**.
  - Sparito mentre ne compare uno identico (stesso settore, zona, categoria e sindacati) con un'altra data: **rinviato**, con collegamento al nuovo.
  - Ogni stato è spiegato all'utente, che viene sempre invitato a verificare con l'azienda.
- **Perché:** le revoche sono l'informazione che più spesso non arriva a chi deve partire. Meglio dedurle in modo prudente e spiegarlo che non mostrarle affatto.

### Colonna «Note» solo nella pagina HTML
- **Lezione:** la pagina `.../mit2/public/scioperi` ha una colonna «Note» che il feed non ha (per esempio «GARANTITI I VOLI DA E PER L'AEROPORTO DI BARI», che sembra strana su uno sciopero ENAV a Malpensa ma è proprio così nella tabella ufficiale).
- **Decisione:** le note si prendono dalla pagina HTML, abbinandole per data, settore, categoria e modalità, **solo quando il feed è cambiato**. Altrimenti si tengono quelle già note. Se la pagina non risponde, si va avanti senza: non è mai un errore bloccante.
- **Perché:** si riduce il traffico verso il Ministero (download moderato) e si evita che le note «sfarfallino».

### Settori coinvolti ed esclusi letti dal testo ufficiale
- **Lezione:** alcuni scioperi «Generale» compaiono nel calendario dei trasporti ma dicono «CON ESCLUSIONE SETTORE TRASPORTI». Altri escludono solo i treni («ESCLUSO TRASPORTO FERROVIARIO»). Altri ancora, per i treni, iniziano la sera prima della data ufficiale («FERROVIARIO DALLE 21.00 DEL 19/11» per uno sciopero del 20/11).
- **Lezione dell'11 novembre 2026:** il Ministero ha cambiato lo sciopero CGIL del 20/11. Ora le modalità dicono «INTERA GIORNATA DI LAVORO* - APPALTI FERROVIARI, TPL, …» e la nota dice «*ESCLUSI SETTORI TRASPORTO AEREO, FERROVIARIO, TRASPORTO MERCI SU ROTAIA, E VARIE SOCC. TPL». **L'asterisco collega la nota alle modalità**, quindi treni e aerei sono esclusi. Inoltre «appalti ferroviari» (pulizie, ristorazione) non vuol dire «treni», e «merci su rotaia» non esclude le merci su strada.
- **Decisione** (`analizzaCoinvolgimento` e `giorniToccati` in `scripts/lib/normalizza.mjs`):
  - si leggono categoria e modalità;
  - dalle note si legge **solo** l'esclusione richiamata da un asterisco presente anche nelle modalità o nella categoria; le altre note parlano delle adesioni di altri sindacati e si ignorano;
  - uno sciopero che esclude tutti i trasporti viene mostrato con l'etichetta «Non riguarda i trasporti» e non viene contato;
  - le date anticipate contano solo se distano al massimo 2 giorni da quelle ufficiali.
- **Perché:** la domanda del sito è «lo sciopero tocca me?». Contare uno sciopero che esclude i trasporti sarebbe un falso allarme; ignorare la sera prima farebbe perdere un treno.
- **Da tenere d'occhio:** il Ministero scrive questi testi a mano. Se compaiono forme nuove, va aggiunta una prova in `test/feed.test.mjs` con il testo reale.

### Orari: solo quando sono certi
- **Decisione:** si riconoscono solo alcuni schemi inequivocabili: «4 ORE: DALLE 09.59 ALLE 13.59», «24 ORE», «INTERA GIORNATA» e «DALLE 21.00 DEL 20/11 ALLE 20.00 DEL 21/11» con le date del testo uguali a quelle ufficiali. Per tutto il resto si mostra il testo ufficiale reso leggibile.
- **Perché:** non inventare orari.

### Testo reso leggibile
- **Decisione:** il Ministero scrive tutto in maiuscolo. `leggibile()` in `scripts/lib/presenta.mjs` mette in minuscolo le parole comuni, tiene le sigle (ATM, ENAV, CGIL…) e trasforma le vocali con apostrofo in vocali accentate («MODALITA'» diventa «modalità»). La pagina di ogni sciopero mostra anche il testo originale.
- **Perché:** il maiuscolo è difficile da leggere, soprattutto per le persone anziane.

### Licenza dei dati
- Le note legali del sito del Ministero (lette tramite Wayback Machine, perché `www.mit.gov.it` ha una catena di certificati incompleta che fa fallire curl) dicono che i contenuti sono in **CC BY 3.0 IT** «salvo ove diversamente indicato».
- **Decisione:** citare sempre la fonte con link, non usare loghi né stemmi, dichiarare che i dati sono rielaborati.

### Scuola e pubblico impiego: non inclusi
- **Valutazione:** il «Cruscotto degli scioperi nel pubblico impiego» della Funzione Pubblica (`crusc-gepas.perlapa.gov.it`) è un'applicazione Angular. Le sue API (`gepas-api.perlapa.gov.it/api/Public/Scioperi/...`) non sono documentate, rispondono 400 a richieste semplici e sono limitate via CORS all'applicazione stessa. Non ci sono un feed né condizioni d'uso.
- **Decisione:** non aggiungerla. Il sito rimanda al cruscotto per scuola e sanità.
- **Perché:** la specifica chiede di aggiungere la fonte solo se è affidabile e leggibile in automatico. Un'API interna può cambiare senza preavviso.

### Commissione di garanzia
- Il calendario di `cgsse.it` sarebbe un buon controllo incrociato, ma il server non invia il certificato intermedio e il certificato non copre `www.cgsse.it`, quindi lo scaricamento automatico fallisce.
- Non usato come fonte. Usato solo per verificare a mano le regole sulle fasce.

## Fasce di garanzia

### Solo da fonti ufficiali, con citazione e data
- **Decisione:** `data/fasce_garanzia.json` contiene per ogni azienda la citazione testuale (`fasce_testo`) e il link alla fonte. Ha gli orari in forma strutturata **solo** se la fonte li indica esplicitamente come garantiti. `origine` vale `regola` (documento stabile) oppure `avviso` (avviso di un singolo sciopero, con la data). Dove non c'è una fonte ufficiale, nessun orario: solo il link agli avvisi.
- **Come è stato fatto:** tre sub-agenti hanno raccolto le pagine (treni e aerei; città del nord; centro-sud). Poi ho ricontrollato ogni citazione: 27 sui file da loro salvati, 13 riscaricando io le pagine. Errori trovati e corretti:
  - l'attribuzione Ravenna/Rimini di Start Romagna era giusta, ma andava verificata perché la pagina ha tre bacini;
  - per ATM e NET Monza l'avviso dice quando il servizio **non** è garantito: ho tenuto solo la citazione, senza ricavare orari «per differenza»;
  - Firenze usa l'avviso di Autolinee Toscane per Livorno, Lucca e Massa-Carrara, che dichiara «modalità di attuazione uniche su tutto il territorio regionale».
- **Senza fasce verificabili:** Bologna (TPER: pagine 403 o 404), Brescia (403 anche con curl), Parma (TEP: avvisi rimossi), Novara (SUN), Napoli ANM (sito tutto in JavaScript), Cagliari (CTM, avvisi caricati in JavaScript), Foggia (ATAF), Italo (pubblica solo elenchi di treni per singolo sciopero). Esclusi Reggio Calabria (ATAM: HTTPS con certificato non valido) e Cosenza (AMACO non raggiungibile, in liquidazione).
- **Da rifare una volta l'anno:** le aziende cambiano pagine; il campo `verificato_il` aiuta. Le voci con origine `avviso` sono quelle che invecchiano prima.

## Architettura

### GitHub Actions più Cloudflare Pages, collegati via Git
- **Decisione:** repository pubblico su GitHub; il workflow salva i dati con un commit; Cloudflare Pages ricostruisce a ogni commit.
- **Perché:**
  - nessun segreto di Cloudflare finisce su GitHub, a differenza del caricamento diretto con un token;
  - `_headers` permette le intestazioni di sicurezza, che GitHub Pages non permette;
  - i minuti di Actions sono illimitati nei repository pubblici;
  - ogni commit è anche «attività», quindi GitHub non disattiva il workflow dopo 60 giorni.

### Quando pubblicare (limite di 500 build al mese)
- **Decisione** (`decidiPubblicazione` in `scripts/aggiorna.mjs`): si controlla ogni 30 minuti (minuti 7 e 37, per evitare l'inizio dell'ora, quando GitHub è sovraccarico). Si pubblica solo:
  - se i dati cambiano;
  - alla prima segnalazione di fonte guasta, o quando la fonte torna;
  - al primo controllo dopo la mezzanotte italiana, perché l'HTML statico di «oggi» e «domani» va rifatto;
  - comunque ogni 6 ore, come «battito» che mostra che il controllo è vivo.
- **Stima:** da 120 a 250 build al mese.
- **Avviso «dati non aggiornati»:** compare dopo 8 ore senza pubblicazioni, cioè 6 più un margine per i ritardi di GitHub.
- **Perché:** con una pubblicazione ogni 30 minuti si arriverebbe a 1.440 build al mese, ben oltre il limite. Con il battito il sito può invece dire onestamente da quanto i dati non si aggiornano.

### Le date si calcolano anche nel browser
- **Decisione:** l'HTML statico è costruito con la data di Roma al momento della build e contiene tutto, quindi è leggibile anche senza JavaScript e da Google. JavaScript ricalcola «oggi», «domani» e «prossimi giorni» con l'orologio del telefono (fuso Europe/Rome), ma solo se la data è cambiata o se l'utente ha scelto una città.
- **Perché:** è corretto anche se una build salta, e non provoca spostamenti della pagina, che peggiorerebbero l'esperienza e il punteggio di Lighthouse.

### Logica condivisa tra build e browser
- **Decisione:** `src/js/{date,filtri,schede,elenchi,assistente}.mjs` non usano né il DOM né il file system. La build li importa per l'HTML statico; il browser li usa per ridisegnare. La build li copia in `public/js/` come `.js`, aggiungendo la versione agli import.
- **Perché:** stesse regole e stessi testi in tutti e due i casi; un solo posto da correggere.

### Lavoro con permesso di scrittura senza dipendenze
- **Decisione:** `scripts/aggiorna.mjs` e i suoi moduli usano solo Node.js. Il lavoro di GitHub che può fare push non esegue `npm ci`. La prova della build (con le dipendenze) gira in un lavoro di sola lettura, **dopo** il salvataggio; se fallisce, apre una segnalazione.
- **Perché:** una dipendenza compromessa non deve mai girare con un token che può scrivere nel repository. Non ho usato gli artifact per passare i dati tra i lavori: un pezzo in meno da far funzionare e da mantenere.

### Dipendenze
- `@resvg/resvg-wasm`: disegna le immagini di anteprima (Open Graph) da SVG, senza binari nativi e senza script di installazione. È l'unica dipendenza della build: Cloudflare e la prova di build installano con `--omit=dev`, cioè un solo pacchetto.
- `ical.js`: valida i calendari nei test.
- `puppeteer-core`: schermate e controllo della console con il Chromium di sistema, senza scaricare browser.
- Lighthouse è stato usato da una cartella temporanea, non è una dipendenza del progetto.
- Font Atkinson Hyperlegible (licenza OFL), incluso, solo per le immagini di anteprima. Il sito usa i font di sistema: niente download e nessuna dipendenza da CDN.

### Calendari (iCalendar)
- **Decisione:**
  - un calendario per ogni città (54) e regione (20), senza gli scioperi del solo trasporto merci;
  - uno per settore (12) e uno nazionale;
  - un file per ogni singolo sciopero, per il pulsante «Aggiungi al calendario».
  - Gli UID sono `mit-<codice>@<dominio>`; `SEQUENCE` cresce a ogni modifica, anche dei campi calcolati.
  - Revocati e rinviati restano nel feed con `STATUS:CANCELLED`, così i calendari ricevono la revoca.
- **Perché:** pochi file (nessuna combinazione città per settore) e la revoca che arriva anche a chi si è già iscritto.
- **Tempi reali di aggiornamento:** **non ho potuto misurarli io**, perché non posso creare account Google o Apple. Le fonti pubbliche (guide di vari servizi e prove riportate da sviluppatori) indicano per Google Calendar da circa 8 a 24 ore, senza possibilità di forzarlo; per iPhone dipende da «Scarica nuovi dati». Il sito lo dice in modo semplice e consiglia di controllare il giorno prima.
- **Link per Google:** `https://www.google.com/calendar/render?cid=webcal://…`, il formato verificato dalla guida di Simon Willison.

### Assistente senza intelligenza artificiale
- **Decisione:** regole scritte a mano in `src/js/assistente.mjs`; parole chiave, aziende e risposte in `data/assistente.json`, modificabile senza toccare il codice. Riconosce:
  - date: oggi, domani, giorni della settimana, «14 novembre», «14/11», fine settimana, settimane, mesi, intervalli;
  - città e regioni con varianti ed errori di battitura (distanza di Damerau-Levenshtein, stessa prima lettera, elenco di parole comuni da non scambiare per città: «come» non è Como, «ancora» non è Ancona, «parto» non è Prato, «trento» non è «treno»);
  - settori e aziende.
- Risponde solo con i dati; se non sa, lo dice e propone domande. Il testo dell'utente non viene mai riportato nella risposta. 209 domande di prova con la risposta attesa, in `test/assistente.test.mjs`.
- **Perché:** costo zero, risposte prevedibili, nessun dato che esce dal telefono.

### Pagine e SEO
- **Decisione:** una pagina per ogni sciopero (`/sciopero/AAAA-MM-GG-settore-zona-azienda/`), per ogni città (54) e regione (20), per ogni settore. Gli scioperi conclusi restano 60 giorni con `noindex`, così i link condivisi non si rompono, e poi vengono tolti. Dati strutturati schema.org `Event`, con `EventCancelled` e `EventRescheduled`. Sitemap senza scioperi passati.
- **Perché:** ogni pagina ha dati veri: scioperi della zona, fasce ufficiali, calendario. Niente testo riempitivo.

### Widget
- **Decisione:** `/widget/<città>/` è HTML senza JavaScript, con una politica di sicurezza propria nel `<meta>` e intestazioni che ne permettono l'incorporamento. Le istruzioni sono in `/incorpora/`.
- **Perché:** il percorso dedicato con regole proprie è l'unica eccezione a `frame-ancestors 'none'`. Nessuno script vuol dire nessun rischio per i siti che lo ospitano.

### Affiliazioni
- **Decisione:** tutto in `config/affiliati.mjs`, spento finché i codici sono vuoti. I link sono costruiti dal codice verso domini fissi e validati: una configurazione sbagliata ferma la build.
- **Testo «potrebbero spettarti da 250 a 600 euro»:** solo se nella categoria ufficiale compare il nome di una compagnia aerea e non ENAV, Techno Sky, handling, pulizie, sicurezza o controllori.
- **Perché:** il regolamento UE 261/2004 dà la compensazione quando sciopera il personale della compagnia, di solito non quando scioperano i controllori di volo; non si promettono soldi. Per FlixBus il programma ufficiale passa da Awin (inserzionista «Flixbus IT», id 110876).

### Licenza del codice
- **Decisione:** nessun file di licenza, e `"license": "UNLICENSED"` in `package.json`.
- **Perché:** scegliere se e come far riutilizzare il codice è una decisione del proprietario. Senza licenza, il codice pubblico si può leggere ma non riutilizzare. Se vuoi permetterlo, aggiungi un file `LICENSE` (per esempio MIT). Il font incluso ha la sua licenza OFL in `assets/fonts/OFL.txt`.

## Lezioni tecniche

- **Caratteri invisibili nei comandi.** Scrivendo file da riga di comando, le sequenze ` `, ` ` e `﻿` sono diventate caratteri veri e hanno rotto due espressioni regolari. Ora questi caratteri si costruiscono con `String.fromCharCode` o con escape generati dal codice.
- **Siti con certificati incompleti.** `www.mit.gov.it`, `cgsse.it` e `trenitaliatper.it` non inviano il certificato intermedio. Non si disattiva mai la verifica TLS: si usano la Wayback Machine o l'intermedio scaricato dall'indirizzo AIA del certificato.
- **Statistiche di Cloudflare e politica di sicurezza.** Lo script di Cloudflare Web Analytics viene da un altro dominio. Se si accendono le statistiche, la build aggiunge solo quei due indirizzi alla CSP e toglie Trusted Types (`intestazioniPerConfigurazione` in `scripts/build.mjs`).
- **Cloudflare e `_headers`.** La documentazione non dice cosa succede se la stessa regola toglie e reimposta un'intestazione. Per questo il widget non lo fa, e una prova lo controlla.
- **Strumenti non eseguibili qui.** `actionlint` non è stato eseguito: scaricare ed eseguire un programma esterno non era permesso in questa sessione. Al suo posto c'è `test/workflow.test.mjs`.

## Stato alla consegna (11 novembre 2026)

- 278 prove superate.
- Build: 349 file, 127 pagine nella sitemap.
- Lighthouse mobile: 100 in tutte le categorie su home e pagina di sciopero.
- Dati reali scaricati l'11/11/2026: 30 scioperi.
- Prova con fonte guasta sui dati reali: i dati sono rimasti identici, stessa impronta prima e dopo.
