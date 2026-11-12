# Note di progetto

Questo file è la memoria del progetto. Contiene una voce per ogni decisione o lezione, sempre con il perché. Va letto all'inizio di ogni sessione di lavoro. Le voci esistenti si aggiornano: non si duplicano.

Ultimo aggiornamento: 12 novembre 2026. La guida per il proprietario è `DEPLOY.md`; tutto il resto, sicurezza compresa, è qui.

## Comandi e struttura

Serve Node.js 22 o più recente.

| Comando | Cosa fa |
|---|---|
| `npm ci --ignore-scripts` | Installa le dipendenze bloccate |
| `npm run aggiorna` | Scarica e controlla il calendario ufficiale, aggiorna `data/`. Funziona solo dall'Italia |
| `sh scripts/installa-aggiornamento-italia.sh` | Installa sul computer in Italia l'aggiornamento automatico ogni 30 minuti |
| `npm run build` | Genera il sito in `public/` |
| `npm test` | Esegue tutte le prove |
| `npm run servi` | Serve `public/` su http://127.0.0.1:8080 con le intestazioni di `_headers` |
| `npm run screenshot` | Schermate a 360 px e desktop con Chromium, controllando console e CSP |
| `npm run verifica-online -- fermitutti.com` | Controlli dopo la pubblicazione: HTTPS, intestazioni, DNS, calendari |

| Cartella o file | Contenuto |
|---|---|
| `config/sito.mjs` | Nome e dominio. Nome ed email del titolare arrivano dalle variabili `TITOLARE_NOME` e `TITOLARE_EMAIL` di Cloudflare Pages |
| `config/affiliati.mjs` | Codici di affiliazione, spenti di default |
| `data/` | Archivio degli scioperi, stato dei controlli, fasce garantite, assistente, luoghi, settori |
| `scripts/aggiorna.mjs` | Aggiornamento dei dati, senza dipendenze esterne, e sorveglianza da GitHub |
| `scripts/aggiorna-italia.sh` | Lo script che il timer del computer in Italia avvia ogni 30 minuti |
| `scripts/build.mjs`, `scripts/lib/` | Generazione del sito: pagine, calendari, immagini, file serviti senza commenti |
| `src/` | CSS, intestazioni (`_headers`), caratteri e JavaScript del browser (`src/js/`, condiviso con la build) |
| `functions/api/stato.js` | L'unica funzione di Cloudflare: passa al browser l'ora dell'ultimo controllo, presa dall'etichetta `stato` su GitHub |
| `test/` | Prove automatiche (`node --test`) |
| `.github/workflows/` | Sorveglianza dell'aggiornamento, verifica del codice, controllo online |

I dati degli scioperi sono del Ministero delle Infrastrutture e dei Trasporti (licenza CC BY 3.0 IT), rielaborati. Il sito non è ufficiale.

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

### Il Ministero si legge solo dall'Italia
- **Lezione dell'11 novembre 2026:** al primo avvio su GitHub l'aggiornamento è fallito con «fetch failed». Prova di connessione alla porta 443 di `scioperi.mit.gov.it` con check-host.net: risponde solo da Milano; da Germania, Francia, Paesi Bassi, Polonia, Regno Unito, Stati Uniti e Asia la connessione scade. Il server filtra per indirizzo italiano. `www.mit.gov.it` e `dati.mit.gov.it` rispondono da tutto il mondo, ma non hanno i dati: le pagine «calendario-scioperi» rimandano a `scioperi.mit.gov.it`. `www.cgsse.it` non risponde dagli Stati Uniti.
- **Decisione:** i dati li legge un computer in Italia (`scripts/aggiorna-italia.sh`, avviato ogni 30 minuti da un timer di systemd dell'utente, installato da `scripts/installa-aggiornamento-italia.sh`). GitHub fa solo da sorveglianza (`node scripts/aggiorna.mjs --sorveglia`, ogni due ore): se il computer vede la fonte guasta, o se da più di 9 ore (`ORE_SORVEGLIANZA`) non arriva una verifica riuscita, segna l'avviso sul sito e apre una segnalazione; quando i dati tornano, la chiude.
- **Perché:** è gratis e non aggiunge server. Non si aggira il blocco con VPN o proxy: si legge da dove il Ministero permette di leggere. Le alternative sempre accese, cioè un Raspberry Pi a casa o una macchina gratuita in Italia, usano lo stesso script.
- **Sicurezza del computer:** il timer esegue una copia fissa del codice (`~/.local/share/fermitutti/codice`), presa dall'ultimo commit locale al momento dell'installazione, con le sole dipendenze bloccate della build. Il codice che arriva da GitHub non viene eseguito. Nella copia del repository (`~/.local/share/fermitutti/repo`) cambiano e si inviano solo `data/scioperi.json` e `data/stato.json`, dopo una build di prova completa. Se `git fetch` fallisce lo script si ferma senza toccare niente, così un guasto della rete di casa non diventa una «fonte guasta».
- **Se un giorno il Ministero apre l'accesso dall'estero** basta tornare al vecchio workflow: in `.github/workflows/aggiorna.yml` togliere `--sorveglia` e riportare l'orario a ogni 30 minuti.

### GitHub Actions più Cloudflare Pages, collegati via Git
- **Decisione:** repository pubblico su GitHub. I dati li salva con un commit il computer in Italia; Cloudflare Pages ricostruisce a ogni commit.
- **Perché:**
  - nessun segreto di Cloudflare finisce su GitHub, a differenza del caricamento diretto con un token;
  - `_headers` permette le intestazioni di sicurezza, che GitHub Pages non permette;
  - nei repository pubblici i minuti di Actions sono gratuiti, e la protezione del ramo principale, CodeQL e il blocco dei segreti sono gratis solo lì;
  - ogni commit è anche «attività», quindi GitHub non disattiva il workflow dopo 60 giorni.
- **Sorgente pubblico, ma con meno dettagli in giro (12 novembre 2026):** il proprietario ha valutato il repository privato e ha deciso di lasciarlo pubblico, che con l'account gratuito tiene tutte le protezioni di GitHub. Il sito non linka più il repository. Al browser JavaScript e CSS arrivano senza commenti (`scripts/lib/compatta.mjs`, prudente: toglie solo righe intere e nel dubbio non tocca il file). Il lavoro che apre e chiude le segnalazioni parte solo dopo un ripristino recente e una volta al giorno, per non sprecare esecuzioni.

### Dominio `fermitutti.com` su Cloudflare
- **Decisione:** `fermitutti.com`, registrato su Cloudflare l'11 novembre 2026. Cloudflare non vende i `.it`. Dominio, DNS e sito stanno nello stesso account.
- **Perché:** non serve cambiare i nameserver; il DNSSEC si attiva con un clic, perché Cloudflare invia da solo il record DS al registro; prezzo di costo; whois oscurato.
- **Nel codice:** il dominio compare solo in `config/sito.mjs` (`dominio` e `urlBase`). Le prove lo leggono da lì con `test/dominio.mjs`, quindi un cambio di dominio non tocca le prove.
- **Nome:** «Fermi Tutti», scelto l'11 novembre 2026 tra cinque candidati (gli altri erano domanisciopero, radarscioperi, cisciopero e meteodisagi). È breve, facile da dettare e funziona da marchio. Non contiene «sciopero», ma i titoli delle pagine sì.
- **Marchi:** ricerca su TMview dell'11 novembre 2026: un solo marchio «fermi tutti», turco, del 2005, classi 25 e 35, terminato. Nessun conflitto. Sul web l'espressione compare solo come titolo di un podcast di RaiPlay Sound e di alcuni libri.
- **`fermitutti.it`** era ancora libero l'11 novembre 2026. Non serve al sito. Se un giorno si vuole proteggere il nome: comprarlo da un registrar che vende i `.it` e gestisce il DNSSEC (per esempio OVHcloud), metterlo su Cloudflare e reindirizzarlo con un 301 verso `https://fermitutti.com`.
- **Posta:** `scripts/verifica-online.mjs` accetta due configurazioni: nessuna email (SPF `-all` e MX nullo) oppure solo l'inoltro di Cloudflare (Email Routing). Se l'email del titolare è sul dominio del sito, la pagina della privacy dice da sola che le email passano dall'inoltro di Cloudflare.
- **Dati del titolare fuori dal repository:** nome ed email arrivano dalle variabili `TITOLARE_NOME` e `TITOLARE_EMAIL` di Cloudflare Pages (`titolareDaAmbiente` in `scripts/build.mjs`). In `config/sito.mjs` restano i segnaposto. Perché: il repository è pubblico e la sua storia conserva per sempre ciò che vi passa, e il nome del titolare va esposto il meno possibile. Per la stessa ragione il nome compare solo nella pagina Privacy, che ha `noindex` ed è fuori dalla sitemap ma non da robots.txt, così Google può leggere il noindex. Le Note legali rimandano alla pagina Privacy. Una prova lo verifica su tutti i file generati. Valori non validi, per esempio con un a capo, fermano la build perché l'email finisce anche in `security.txt`.
- **Pages, non Workers:** l'11 novembre 2026 il pannello di Cloudflare ha creato per primo un Worker con risorse statiche. Prova sul sito pubblicato su `workers.dev`: intestazioni di `_headers` corrette, anche quelle staccate del widget, calendari, `security.txt` e pagina Privacy a posto. Però la pagina «non trovata» arrivava vuota senza `not_found_handling`, a ogni pubblicazione `npx wrangler deploy` scaricava l'ultima versione di wrangler senza lockfile, e l'indirizzo `workers.dev` conteneva il nome dell'account. Decisione: restare su Pages, che pubblica senza wrangler. La build si ferma per i segnaposto anche con `WORKERS_CI=1`.

### Quando pubblicare (limite di 500 build al mese)
- **Decisione** (`decidiPubblicazione` in `scripts/aggiorna.mjs`): si controlla ogni 30 minuti (minuti 7 e 37, per evitare l'inizio dell'ora, quando GitHub è sovraccarico). Si pubblica solo:
  - se i dati cambiano;
  - alla prima segnalazione di fonte guasta, o quando la fonte torna;
  - al primo controllo dopo la mezzanotte italiana, perché l'HTML statico di «oggi» e «domani» va rifatto;
  - comunque ogni 6 ore, come «battito» che mostra che il controllo è vivo.
- **Stima:** da 120 a 250 build al mese.
- **Avviso «dati non aggiornati»:** compare dopo 8 ore senza pubblicazioni, cioè 6 più un margine per i ritardi di GitHub.
- **Perché:** con una pubblicazione ogni 30 minuti si arriverebbe a 1.440 build al mese, ben oltre il limite. Con il battito il sito può invece dire onestamente da quanto i dati non si aggiornano.

### Ora dell'ultimo controllo ogni 30 minuti, senza build (12 novembre 2026)
- **Problema:** la pagina diceva «Ultimo controllo della fonte ufficiale: 04:57» alle 9:30, mentre il computer aveva controllato il Ministero ogni 30 minuti. Era l'ora dell'ultima pubblicazione, non dell'ultimo controllo. Il proprietario vuole vedere l'ora vera, ogni mezz'ora, senza consumare build e senza toccare il pannello di Cloudflare.
- **Decisione:**
  - dopo ogni controllo `scripts/aggiorna-italia.sh` invia `data/stato.json` sull'etichetta (tag) `stato`, come commit senza genitori con quel solo file, con push forzato. Il messaggio inizia con `[CF-Pages-Skip]`;
  - `functions/api/stato.js`, l'unica funzione di Cloudflare Pages, legge quel file da `raw.githubusercontent.com` (copia di 60 secondi nella cache di Cloudflare) e restituisce solo tre date validate: `ultima_verifica_riuscita`, `ultima_modifica_dati`, `fonte_guasta_dal`;
  - `public/_routes.json`, scritto dalla build, fa partire la funzione solo su `/api/stato`. Tutto il resto resta file statico e non conta nel limite delle funzioni;
  - il browser (`controlloRecente` in `src/js/stato.mjs`) sostituisce l'ora negli elementi `time[data-controllo]` solo se il controllo è più recente di quello pubblicato, la fonte funziona e `ultima_modifica_dati` è uguale a quella del sito. Così non mostra mai «controllato alle 9:07» accanto a dati più vecchi, per esempio nei minuti in cui Cloudflare ricostruisce. Lo stesso controllo, se recente, evita l'avviso «dati non aggiornati».
- **Perché un'etichetta e non un ramo:** Cloudflare Pages costruisce i commit sui rami, compresi i rami di anteprima, attivi di default. La documentazione non dice se le build saltate con `[CF-Pages-Skip]` contano nel limite delle 500. Le etichette non vengono costruite; la sigla resta come seconda protezione. Con un commit senza genitori e il push forzato la storia del repository non cresce. I workflow di GitHub non partono, perché quel commit non contiene `.github/`.
- **Perché una funzione e non una lettura diretta da GitHub nel browser:** così l'indirizzo IP dei visitatori non arriva a GitHub, e la politica di sicurezza resta `connect-src 'self'`.
- **Limiti:** 100.000 richieste al giorno nel piano gratuito di Workers, che non può addebitare costi. Se la funzione o GitHub non rispondono, la pagina mostra l'ora dell'ultima pubblicazione come prima. Se la fonte si guasta, lo script riparte dallo stato pubblicato su `main`: i controlli riusciti mai pubblicati vanno persi e l'etichetta può tornare indietro di qualche mezz'ora. È innocuo, perché con la fonte guasta il browser ignora l'ora nuova.
- **In locale** `scripts/servi.mjs` risponde a `/api/stato` con le date di `public/dati/stato.json`, senza collegarsi a GitHub.

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

### Aspetto (rifatto il 12 novembre 2026)
- **Colori di stato con un significato:** rosso = sciopero confermato, ambra = rinviato, verde = revocato, grigio = concluso o tolto. Prima «Confermato» era verde, cioè sembrava una buona notizia. Gli stessi colori valgono per le schede, la pagina dello sciopero, le immagini di anteprima e il widget.
- **Carattere:** Atkinson Hyperlegible, pensato per chi vede poco, servito dal sito stesso in WOFF2 ridotto ai caratteri latini (`src/caratteri/`, circa 15 KB per peso, con la licenza OFL accanto). Le cifre sono escluse dal file, quindi i numeri usano il carattere di sistema: lo zero barrato di Atkinson nei numeri grandi sembrava il simbolo dell'insieme vuoto. `font-display: optional` con precaricamento del peso normale: nessuno spostamento della pagina.
- **Schede più pulite:** niente sigle dei sindacati nelle schede, che restano nella pagina dello sciopero. Gli scioperi identici per chi viaggia (stesso giorno, luogo, orari, personale e stato) diventano una scheda sola con l'elenco apribile delle proclamazioni (`raggruppa` in `src/js/elenchi.mjs`). I conteggi del riepilogo restano per singolo sciopero, come nel calendario ufficiale. Le modalità molto lunghe si accorciano nella scheda (`accorcia` in `src/js/schede.mjs`). Tutta la scheda è cliccabile.
- **Pagina dello sciopero:** i fatti principali in una griglia unica, il testo ufficiale del Ministero e le citazioni delle fasce in elementi apribili, il calendario in un riquadro breve che rimanda a `/calendario/` per le istruzioni. Sul telefono la pagina è scesa da circa 5.600 a 3.100 pixel di altezza.
- **Menu:** «Oggi», «Città», «Settori», «Calendario», «Chiedi». Sul telefono «Settori» si nasconde per stare in una riga, ed è nel piè di pagina e nella home.
- **Efficienza:** la pagina contiene la data di costruzione (`data-oggi`); il browser scarica i dati e ridisegna gli elenchi solo se il giorno o la zona sono cambiati.
- **Verifica:** Lighthouse mobile 100 in tutte le categorie su home, pagina di sciopero e pagina di Milano, spostamento della pagina 0, contenuto principale in circa un secondo.

### Widget
- **Decisione:** `/widget/<città>/` è HTML senza JavaScript, con una politica di sicurezza propria nel `<meta>` e intestazioni che ne permettono l'incorporamento. Le istruzioni sono in `/incorpora/`.
- **Perché:** il percorso dedicato con regole proprie è l'unica eccezione a `frame-ancestors 'none'`. Nessuno script vuol dire nessun rischio per i siti che lo ospitano.

### Affiliazioni
- **Decisione:** tutto in `config/affiliati.mjs`, spento finché i codici sono vuoti. I link sono costruiti dal codice verso domini fissi e validati: una configurazione sbagliata ferma la build.
- **Testo «potrebbero spettarti da 250 a 600 euro»:** solo se nella categoria ufficiale compare il nome di una compagnia aerea e non ENAV, Techno Sky, handling, pulizie, sicurezza o controllori.
- **Perché:** il regolamento UE 261/2004 dà la compensazione quando sciopera il personale della compagnia, di solito non quando scioperano i controllori di volo; non si promettono soldi. Per FlixBus il programma ufficiale passa da Awin (inserzionista «Flixbus IT», id 110876).

### Licenza del codice
- **Decisione:** nessun file di licenza, e `"license": "UNLICENSED"` in `package.json`.
- **Perché:** scegliere se e come far riutilizzare il codice è una decisione del proprietario. Senza licenza, il codice pubblico si può leggere ma non riutilizzare. Il font incluso ha la sua licenza OFL in `assets/fonts/OFL.txt`, copiata accanto ai file serviti.

## Lezioni dalla revisione di sicurezza (11 novembre 2026)

### Un dato valido per la validazione può comunque rompere la build
- **Lezione:** un settore chiamato `constructor` trovava le proprietà ereditate degli oggetti JavaScript; un anno «0100» produceva una data ISO a 3 cifre; un carattere U+FFFF faceva fallire il disegno dell'immagine. Erano dati accettati dall'aggiornamento e salvati nel repository, che poi bloccavano ogni build per tutta la durata della conservazione (fino a mesi).
- **Decisione:**
  - cercare chiavi che vengono dalla fonte solo con `Object.hasOwn`;
  - limitare gli anni al periodo 2000-2100;
  - togliere i caratteri non ammessi in XML;
  - soprattutto, **provare la costruzione in memoria prima di salvare** (`scripts/lib/prova-costruzione.mjs`) con gli stessi moduli della build: se un dato non diventa una pagina, un calendario e un'anteprima, non entra nel repository.
- **Perché:** la cosa peggiore per un sito che deve andare avanti da solo è un blocco che serve uno sviluppatore per sbloccarlo.

### Limiti di crescita
- **Decisione:**
  - al massimo 500 elementi nel feed;
  - rifiutato un aumento oltre 150 e oltre il triplo degli scioperi validi;
  - al massimo 100 nuovi per aggiornamento e 1.500 in archivio.
  - L'interruttore manuale `accetta_variazione` del workflow (prima `accetta_calo`) vale sia per i cali sia per gli aumenti.
- **Perché:** un feed manipolato poteva aggiungere migliaia di scioperi finti, superare il limite di 20.000 file di Cloudflare e restare in archivio per mesi.

### Analisi in tempo lineare
- **Lezione:** espressioni regolari con gruppi pigri sull'intero feed (per gli `<item>`, le tabelle e il titolo) diventano lentissime su input costruiti apposta: un titolo da 7 KB richiedeva minuti.
- **Decisione:** blocchi estratti con `indexOf` (`blocchi()` in `scripts/lib/feed.mjs`), tag tolti con un'espressione lineare, regex del titolo solo su titoli fino a 400 caratteri, limiti di 1 MB per il feed e 2 MB per la pagina. Le prove misurano i tempi.

### Niente testo della fonte nelle segnalazioni
- **Decisione:** i messaggi di validazione dicono campo e posizione, non il valore. `senzaIndirizzi()` toglie link ed email. Nella issue il messaggio va in un blocco di codice.
- **Perché:** una segnalazione arriva al proprietario come email dal suo stesso repository: un link ingannevole lì sarebbe molto credibile.

## Lezioni tecniche

- **Caratteri speciali nei comandi.** Scrivendo file da riga di comando, alcune sequenze di escape per i separatori di riga Unicode sono diventate caratteri veri e hanno rotto due espressioni regolari. Anche una barra rovesciata si è persa: l'escape del punto e virgola nei calendari è diventato un semplice `;`, e il test era sbagliato allo stesso modo. Ora i caratteri delicati si costruiscono con `String.fromCharCode` (per esempio `BARRA` in `scripts/lib/ics.mjs`), e una prova controlla il risultato finale nei file generati.
- **Barre rovesciate doppie.** Verificato di nuovo l'11 novembre 2026: nei comandi una doppia barra rovesciata arriva nel file come barra singola, mentre una barra singola resta. Nelle prove, i testi letterali dentro le espressioni regolari si costruiscono con `letterale()` di `test/dominio.mjs`.
- **Siti con certificati incompleti.** `www.mit.gov.it`, `cgsse.it` e `trenitaliatper.it` non inviano il certificato intermedio. Non si disattiva mai la verifica TLS: si usano la Wayback Machine o l'intermedio scaricato dall'indirizzo AIA del certificato.
- **Statistiche di Cloudflare e politica di sicurezza.** Lo script di Cloudflare Web Analytics viene da un altro dominio. Se si accendono le statistiche, la build aggiunge solo quei due indirizzi alla CSP e toglie Trusted Types (`intestazioniPerConfigurazione` in `scripts/build.mjs`).
- **Cloudflare e `_headers`.** La documentazione non dice cosa succede se la stessa regola toglie e reimposta un'intestazione. Per questo il widget non lo fa, e una prova lo controlla.
- **Strumenti non eseguibili qui.** `actionlint` non è stato eseguito: scaricare ed eseguire un programma esterno non era permesso in questa sessione. Al suo posto c'è `test/workflow.test.mjs`.

## Stato alla consegna (11 novembre 2026)

- 293 prove superate, comprese quelle nate dalla revisione di sicurezza indipendente.
- Build: 349 file, 127 pagine nella sitemap.
- Lighthouse mobile: 100 in tutte le categorie su home, pagina di sciopero e pagina di città.
- Dati reali scaricati l'11/11/2026: 30 scioperi.
- Prova con fonte guasta sui dati reali: i dati sono rimasti identici, stessa impronta prima e dopo.
- Sito pubblicato su `fermitutti.com` con Cloudflare Pages l'11 novembre 2026. Nome ed email del titolare nelle variabili di Cloudflare. Aggiornamento dei dati dal computer in Italia, sorveglianza da GitHub.

## Sicurezza

Nessun sito è invulnerabile. Questo è costruito in modo da eliminare per costruzione intere classi di attacchi e da chiudere le altre. Qui trovi cosa è stato fatto, come è stato verificato e quali rischi restano.


### 1. Superficie minima

- **Solo file statici, con un'eccezione.** Nessun server, nessun database. Non ci sono pagine di accesso da forzare né dati da rubare sul server. L'unico codice che gira quando qualcuno visita il sito è `functions/api/stato.js`, solo su `/api/stato`, approvato dal proprietario il 12 novembre 2026 per mostrare l'ora dell'ultimo controllo ogni 30 minuti. Non legge niente della richiesta, non ha segreti, non scrive nulla e restituisce soltanto tre date validate, prese da un file pubblico del repository. Le regole di `_headers` non valgono per le funzioni: le intestazioni di sicurezza le imposta la funzione stessa.
- **Nessun modulo che invia dati, nessun account, nessun dato personale raccolto.** La città scelta e il tema restano nel browser (`localStorage`). Le domande all'assistente non escono dal dispositivo.
- **Nessun cookie e nessun tracciamento.** Le statistiche di Cloudflare sono spente; si possono accendere solo in modo esplicito, vedi `DEPLOY.md`.
- **Nessuno script, font o foglio di stile da siti esterni.** Il font usato per le immagini di anteprima è incluso nel repository (licenza OFL) e serve solo durante la build.
- **Una sola dipendenza nel sito**, `@resvg/resvg-wasm`, che disegna le immagini di anteprima durante la build e non arriva mai ai visitatori. Le altre due, `ical.js` e `puppeteer-core`, servono solo per le prove.

### 2. I dati della fonte non sono fidati

Il calendario del Ministero viene trattato come un dato che potrebbe essere manipolato.

- **Lettura** (`scripts/lib/feed.mjs`, `scripts/aggiorna.mjs`).
  - Il feed viene rifiutato se non è RSS, se supera 1 MB o se contiene dichiarazioni `DOCTYPE` o `ENTITY`. Il limite per la pagina HTML è 2 MB; i file reali pesano circa 25 KB e 315 KB.
  - Il download segue i reindirizzamenti solo verso lo stesso sito ed è interrotto oltre il limite anche senza `Content-Length`.
  - Vengono tolti i tag, i caratteri di controllo, quelli invisibili o che cambiano la direzione del testo e quelli vietati in XML (come U+FFFF).
  - L'analisi ha tempo lineare: i blocchi si cercano con `indexOf` e non con espressioni regolari che possono diventare lentissime. Un titolo più lungo di 400 caratteri viene rifiutato prima di analizzarlo.
- **Validazione rigorosa** (`scripts/lib/valida.mjs`).
  - Rifiuta l'aggiornamento se mancano campi obbligatori o se un codice non ha il formato del Ministero.
  - Rifiuta date impossibili o incoerenti, campi troppo lunghi e codici duplicati.
  - Rifiuta il feed se **un qualsiasi campo contiene markup o link `javascript:`**: il Ministero non li usa mai.
  - Rifiuta il feed se troppi settori sono sconosciuti, segno che il formato è cambiato.
  - Rifiuta il feed se il numero di scioperi crolla a meno della metà, se cresce in modo anomalo (oltre 150 e oltre il triplo di quelli validi), se supera 500 elementi o se in un solo aggiornamento arrivano più di 100 scioperi nuovi. L'archivio non può superare 1.500 scioperi. Chi gestisce il sito può accettare a mano un calo o un aumento reale.
  - I settori si confrontano con `Object.hasOwn`: un settore chiamato `constructor` o `toString` diventa «altro settore» e non rompe nulla.
  - Gli anni fuori dall'intervallo 2000-2100 non sono date valide; le date di proclamazione e ricezione strane vengono ignorate, con un avviso.
  - I messaggi d'errore non riportano i valori della fonte, e indirizzi web ed email vengono tolti: un testo ostile non può arrivare come link cliccabile nelle segnalazioni inviate al proprietario.
- **Prova di costruzione prima del salvataggio** (`scripts/lib/prova-costruzione.mjs`). Prima di salvare i dati nuovi, lo script di aggiornamento genera in memoria, per ogni sciopero, la pagina, il calendario e l'immagine di anteprima. Se qualcosa non riesce, non salva nulla. Così un singolo dato strano non può fermare la build per mesi.
- **Se qualcosa non torna non si pubblica nulla.** Restano gli ultimi dati validi, il sito mostra un avviso onesto e su GitHub si apre una segnalazione che ti arriva per email.
- **Escape per ogni contesto.**
  - HTML e attributi: `e()` in `scripts/lib/html.mjs`.
  - Link: `urlSicuro()` accetta solo percorsi interni, `https:`, `webcal:` e `mailto:`. I link non vengono **mai** presi dai dati del Ministero.
  - JSON nei dati strutturati: `jsonPerScript()` impedisce di chiudere il tag `</script>`.
  - Testo dei calendari: escape RFC 5545 di barre rovesciate, punti e virgola, virgole e ritorni a capo, righe ripiegate a 75 byte. Una prova controlla che nei calendari generati non resti nessun `;` o `,` senza escape.
- **Nel browser** il codice non usa mai `innerHTML`, `eval` o simili: solo `createElement` e `textContent`. Lo garantisce anche il browser stesso, grazie a **Trusted Types** nella politica di sicurezza: un'eventuale scrittura di HTML da testo verrebbe bloccata.
- **Difesa in profondità alla build.** Anche se dati malevoli arrivassero nell'archivio, sia l'aggiornamento sia la build rifiutano campi con `<` o `>`, indirizzi di pagina, settori, date e orari non validi e stati sconosciuti (`scripts/lib/valida-archivio.mjs`). Un'immagine di anteprima che non si riesce a disegnare viene sostituita da quella generica.

### 3. Intestazioni HTTP (`src/_headers`)

- **Content-Security-Policy**: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`, `upgrade-insecure-requests`, `require-trusted-types-for 'script'`, `trusted-types 'none'`. Nessun `'unsafe-inline'` e nessun `'unsafe-eval'`; nel sito non ci sono script né stili in linea.
- **Strict-Transport-Security**: 2 anni con `includeSubDomains`. Il `preload` è lasciato fuori di proposito: va aggiunto solo dopo aver visto che tutto funziona in HTTPS (passo 17 di `DEPLOY.md`).
- **Altre intestazioni:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (contro il clickjacking), `Referrer-Policy: strict-origin-when-cross-origin`, una `Permissions-Policy` che spegne fotocamera, microfono, posizione, pagamenti e simili, e `Cross-Origin-Opener-Policy: same-origin`.
- **Unica eccezione: il widget** (`/widget/*`), che deve potersi incorporare in altri siti.
  - Per quel percorso si tolgono solo `Content-Security-Policy` e `X-Frame-Options`.
  - La pagina del widget porta la sua politica in un tag `<meta>`: `default-src 'none'`, nessuno script.
  - `frame-ancestors` non si può mettere in un `<meta>`, quindi l'incorporamento resta permesso.
  - Nessuna regola toglie e reimposta la stessa intestazione, un caso che la documentazione di Cloudflare non chiarisce.
  - Anche la pagina 404 ha una politica di sicurezza nel `<meta>`: sotto `/widget/` Cloudflare potrebbe servirla con le intestazioni del widget.
- **Nessun redirect aperto.** Il sito non ha pagine che reindirizzano verso indirizzi presi dalla richiesta. Il parametro `?d=` dell'assistente riempie solo il campo della domanda. L'unico reindirizzamento (`www` verso il dominio principale) è fisso e configurato in Cloudflare.

### 4. Catena di fornitura

- Versioni esatte e lockfile (`package-lock.json`). Si installa con `npm ci --ignore-scripts`, così nessuna dipendenza esegue codice durante l'installazione. La build di Cloudflare installa solo la dipendenza che le serve (`--omit=dev`): un solo pacchetto, senza dipendenze a cascata. Il file `.npmrc` imposta `ignore-scripts=true` anche per chi usa `npm install`.
- `npm audit`: 0 vulnerabilità alla consegna. Il workflow «Verifica» blocca se ce ne sono di gravità alta o critica.
- **Dependabot** propone ogni settimana gli aggiornamenti di npm e delle azioni GitHub (`.github/dependabot.yml`). Propone una nuova versione solo 7 giorni dopo la sua uscita (`cooldown`): una versione compromessa di solito viene scoperta e ritirata prima. Gli aggiornamenti di sicurezza arrivano subito.

### 5. GitHub Actions

- Tutte le azioni sono **bloccate al commit SHA completo** (`actions/checkout` v7.0.1, `actions/setup-node` v7.1.0); Dependabot le aggiorna.
- `permissions: {}` come impostazione predefinita, e ogni lavoro chiede solo i permessi che usa.
- **Il lavoro che può scrivere nel repository esegue solo `scripts/aggiorna.mjs`**, che usa Node.js e **nessuna** dipendenza esterna.
  - Le dipendenze npm girano solo nel lavoro di prova, che può solo leggere.
  - Le segnalazioni le apre un terzo lavoro che ha solo il permesso sulle issue.
- `persist-credentials: false` in ogni checkout. Il token si usa una sola volta, per il push, passato in un'intestazione: non resta nella configurazione di git. Anche la sua versione codificata viene mascherata nei registri (`::add-mask::`).
- Nessun `pull_request_target` e nessun `workflow_run`. Timeout su ogni lavoro. `concurrency` per evitare esecuzioni sovrapposte.
- **Nessuna espressione `${{ }}` dentro gli script**: tutti i valori passano da variabili d'ambiente, contro l'iniezione di comandi. Il testo dei messaggi d'errore viene ripulito (niente indirizzi, solo caratteri sicuri, al massimo 900) e nella segnalazione finisce dentro un blocco di codice, dove non diventa un link.
- In `DEPLOY.md` (passo 6) c'è anche come richiedere l'approvazione per i workflow proposti da sconosciuti e l'avvertenza di non unire mai le loro proposte.
- Queste regole sono controllate automaticamente da `test/workflow.test.mjs`.
- In `DEPLOY.md` (passo 6) ci sono le istruzioni per la protezione del ramo principale, il secret scanning, la push protection, Dependabot e CodeQL.

### 6. Dominio e DNS

Istruzioni in `DEPLOY.md`, passi 2 e 7-13 (il 16 per Google Search Console). Il dominio `fermitutti.com` è registrato su Cloudflare, nello stesso account del sito: verifica dell'email del titolare, blocco contro i trasferimenti, rinnovo automatico, DNSSEC con il record DS inviato da Cloudflare al registro, record CAA (solo le autorità di Cloudflare), nessun record orfano, DMARC `p=reject`, un solo reindirizzamento da `www` e da `pages.dev` al dominio principale, solo HTTPS e TLS minimo 1.2.

Per la posta ci sono due configurazioni corrette. Nella prima il dominio non usa email: SPF `v=spf1 -all` e MX nullo. Nella seconda riceve soltanto, con l'inoltro gratuito di Cloudflare (Email Routing) dall'indirizzo di contatto alla casella del titolare: i record MX, SPF e DKIM li crea Cloudflare. In tutti e due i casi nessuno può mandare email credibili a nome del dominio.

Il controllo automatico è `npm run verifica-online -- fermitutti.com`, oppure il workflow «Controllo online» su GitHub. Riconosce da solo quale delle due configurazioni di posta è in uso. Controlla anche che Cloudflare non inserisca script nelle pagine (offuscamento delle email, Rocket Loader), che la politica di sicurezza bloccherebbe.

### 7. Account

La verifica in due passaggi su email, GitHub e Cloudflare, che è anche il registrar del dominio, è il **primo passo** di `DEPLOY.md`, con i codici di recupero su carta. Cloudflare riceve accesso solo al repository del sito.

### 8. security.txt

`/.well-known/security.txt` (RFC 9116) viene rigenerato a ogni build con una scadenza a 180 giorni. Siccome il sito si ricostruisce ogni giorno, la scadenza non passa mai. Il contatto arriva dalla variabile `TITOLARE_EMAIL` di Cloudflare Pages oppure da `config/sito.mjs`. Un valore con un a capo o che non è un indirizzo email ferma la build, così nessuno può aggiungere righe al file attraverso quella variabile.

### 9. Aggiornamento dal computer in Italia

Il server del Ministero accetta solo connessioni dall'Italia, quindi i dati li legge un computer in Italia con un timer di systemd dell'utente (`scripts/aggiorna-italia.sh`). Le regole:

- **Codice fisso.** Il timer esegue una copia del codice presa dall'ultimo commit locale al momento dell'installazione, con le sole dipendenze bloccate della build. Il codice che arriva da GitHub non viene mai eseguito sul computer. Chi riuscisse a modificare il repository non potrebbe quindi far girare niente lì.
- **Solo i dati.** Nella copia del repository usata dal timer cambiano e si inviano soltanto `data/scioperi.json` e `data/stato.json`, con la firma «Fermi Tutti», più l'etichetta `stato` con l'ora dell'ultimo controllo. L'etichetta si invia solo dopo che i dati, se andavano pubblicati, sono arrivati su GitHub. Prima di inviare si costruisce il sito per prova. I dati che arrivano da GitHub passano dagli stessi controlli dell'archivio.
- **Rete di casa.** Se GitHub non risponde lo script si ferma senza toccare niente, così un guasto della rete di casa non viene scambiato per un guasto della fonte.
- **Chiave SSH.** Il timer usa la chiave SSH già presente sul computer. Chi entrasse nel computer potrebbe usarla per modificare il repository: il computer va tenuto aggiornato e protetto come ogni dispositivo personale.
- **Sorveglianza.** GitHub controlla ogni due ore lo stato pubblicato. Se da più di 9 ore non arriva una verifica riuscita, il sito mostra l'avviso ai visitatori e il proprietario riceve una segnalazione. Il sito quindi non può restare fermo in silenzio.

### Come è stato verificato

| Verifica | Risultato |
|---|---|
| `npm test`: 293 prove su parser, validazione, archivio, aggiornamento, calendari, sicurezza, build, workflow, assistente e casi trovati dalla revisione | 293 superate |
| Dati malevoli nel feed: tag `<script>`, `<img onerror>`, link `javascript:`, markup nel titolo, `DOCTYPE`/`ENTITY`, CRLF, caratteri di direzione e invisibili, campi da 20.000 caratteri, reindirizzamento verso un altro sito, centinaia di scioperi finti | Rifiutati, oppure ripuliti nel caso di CRLF e unicode strano; i dati restano intatti |
| Dati che superano la validazione ma rompevano la build: settore `constructor` o `toString`, anno 0100 o 0999, caratteri U+FFFF e U+FDD0 | Ripuliti; aggiornamento e build completa con le immagini riescono |
| Input costruiti per rallentare l'analisi: titolo da 20 KB, 150.000 `<item>` non chiusi, 300.000 `<` | Analizzati in pochi millisecondi |
| Fonte guasta (12 scenari, anche sui dati reali): errore 500, nessuna risposta, pagina HTML, feed vuoto, campi mancanti, date impossibili, calo improvviso | Nessuna pubblicazione di dati sbagliati; la prima segnalazione viene pubblicata, le successive no |
| Calendari validati con la libreria `ical.js` e controlli puntuali (CRLF, righe di al massimo 75 byte, UTF-8 integro, una sola `VEVENT` anche con testo che prova a iniettarne un'altra) | Tutti validi |
| Chromium senza finestra, a 360 px e a 1280 px, tema chiaro e scuro, con le intestazioni reali applicate da un server locale | Nessun errore in console, nessuna violazione della CSP o di Trusted Types, nessuno scorrimento orizzontale |
| Lighthouse 13.6, modalità mobile, su home, pagina di sciopero e pagina di città | 100 in prestazioni, accessibilità, buone pratiche e SEO |
| `npm audit` | 0 vulnerabilità |
| Revisione di sicurezza indipendente (un secondo agente con contesto pulito) | Vedi la sezione qui sotto |

### Revisione indipendente: esito

Un secondo agente, con contesto pulito, ha rivisto tutto il repository rispetto a questa lista e ha provato concretamente ogni sospetto. **Nessun problema di gravità alta**: nessun XSS, nessuna iniezione nei workflow, nessuna fuga del token, nessuna falla nella catena di fornitura. Tutti i problemi trovati sono stati corretti e coperti da prove (`test/revisione.test.mjs`).

| Gravità | Problema trovato | Correzione |
|---|---|---|
| Media | Dati che superavano la validazione ma facevano fallire la build per mesi: settore `constructor`, anno 0100, carattere U+FFFF | `Object.hasOwn`, anni 2000-2100, caratteri non XML tolti, archivio validato e prova di costruzione **prima** del salvataggio, immagini con ripiego |
| Media | Nessun limite alla crescita dell'archivio: un feed manipolato poteva superare i 20.000 file di Cloudflare | Massimo 500 elementi, crescita anomala rifiutata, massimo 100 nuovi per aggiornamento e 1.500 in archivio |
| Bassa | Espressioni regolari lente su input ostili (fino a minuti) | Analisi con `indexOf`, titolo lungo rifiutato prima, limiti di 1 e 2 MB |
| Bassa | Nei calendari il punto e virgola non veniva escapato | Corretto, con una prova su tutti i calendari generati |
| Bassa | Testo della fonte poteva arrivare come link cliccabile nelle segnalazioni | Niente valori nei messaggi, indirizzi tolti, blocco di codice |
| Bassa | Il filtro dei link nel browser accettava `//dominio` | Corretto e condiviso in `src/js/filtri.mjs`, con prove |
| Bassa | Server di prova locale: richiesta malformata lo chiudeva, percorsi con `\` su Windows, nessun controllo dell'host | Corretti tutti, con prove |
| Bassa | Pagina 404 sotto `/widget/` senza politica di sicurezza | Politica nel `<meta>` della 404 e controllo in `verifica-online` |
| Bassa | Token codificato non mascherato nei registri | `::add-mask::` |
| Bassa | Si poteva pubblicare con i segnaposto in `security.txt`; un vecchio `security.txt` inutilizzato | Su Cloudflare la build si ferma se restano segnaposto; file tolto |

Dubbi sulla guida, tutti accolti in `DEPLOY.md`: spegnere le funzioni di Cloudflare che modificano le pagine, approvazione dei workflow proposti da sconosciuti, `gh auth logout` dopo il push, reindirizzamento di `pages.dev`, controllo su hstspreload.org prima del preload, `cooldown` di Dependabot. Il dubbio sulla protezione del trasferimento dei `.it` non vale più: il dominio è un `.com` registrato su Cloudflare, bloccato contro i trasferimenti.

### Rischi che restano

- **Account.** Il rischio più grande: chi entra nel tuo account GitHub, Cloudflare o nella tua email può cambiare il sito o prendersi il dominio. La verifica in due passaggi e i codici di recupero su carta lo riducono molto.
- **Fonte manipolata in modo «plausibile».** Se qualcuno alterasse il sito del Ministero con dati credibili (date e testi normali), il sito li pubblicherebbe, perché non c'è modo di distinguerli da quelli veri. Il danno resta comunque limitato a testo mostrato come testo: nessuno script e nessun link possono passare.
- **Fonte manipolata per fermare il sito.** Chi controllasse il feed potrebbe mandare dati che il sito rifiuta. Il sito resterebbe allora fermo agli ultimi dati validi, con un avviso visibile e una segnalazione per te. Non può però far pubblicare dati che rompono il sito, né riempire l'archivio.
- **Il Ministero non dichiara le revoche.** Uno sciopero che sparisce prima di iniziare viene mostrato come «revocato», ma potrebbe anche essere stato tolto per errore. La spiegazione è sempre visibile e invita a verificare con l'azienda.
- **Workflow su GitHub.** «Verifica», «Controllo online» e l'aggiornamento sono girati su GitHub l'11 novembre 2026: la verifica è verde, l'aggiornamento ha scoperto che il Ministero blocca le connessioni dall'estero. `actionlint`, lo strumento di verifica dei workflow, non è stato eseguito: scaricarlo ed eseguirlo non era permesso in questa sessione. Al suo posto c'è `test/workflow.test.mjs`.
- **Il computer in Italia può restare spento.** Finché è spento i dati non si aggiornano. Dopo 9 ore senza una verifica riuscita il sito lo dice ai visitatori e il proprietario riceve una segnalazione. Per un aggiornamento sempre attivo serve un dispositivo sempre acceso in Italia, per esempio un Raspberry Pi, con lo stesso script.
- **Il comportamento di Cloudflare con `_headers`** è stato riprodotto in locale seguendo la documentazione. Dopo il lancio, il workflow «Controllo online» verifica le intestazioni reali, anche quelle del widget.
- **Funzioni di Cloudflare che modificano le pagine** (offuscamento delle email, Rocket Loader, Bot Fight Mode): se restano accese, inseriscono script che la politica di sicurezza blocca. Non è un rischio per la sicurezza, ma alcune parti potrebbero non funzionare. `DEPLOY.md` dice di spegnerle e il controllo online lo verifica.
- **Dipendenze di terzi.** Una dipendenza compromessa potrebbe alterare la build. Il rischio è ridotto da versioni bloccate, `--ignore-scripts`, un solo pacchetto nella build, nessuna dipendenza nel lavoro con permesso di scrittura, 7 giorni di attesa per le nuove versioni e revisione delle proposte di Dependabot. Ma non è nullo.
- **Calendari iscritti.** Google Calendar può mostrare una revoca con molte ore di ritardo. Il sito lo dice chiaramente e invita a controllare il giorno prima.
- **HSTS preload** non è attivo finché non lo attivi tu (passo 17).
