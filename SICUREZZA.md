# Sicurezza di Fermi Tutti

Nessun sito è invulnerabile. Questo è costruito in modo da eliminare per costruzione intere classi di attacchi e da chiudere le altre. Qui trovi cosa è stato fatto, come è stato verificato e quali rischi restano.

## 1. Superficie minima

- **Solo file statici.** Nessun server, nessun database, nessun codice che gira quando qualcuno visita il sito. Non ci sono pagine di accesso da forzare né dati da rubare sul server.
- **Nessun modulo che invia dati, nessun account, nessun dato personale raccolto.** La città scelta e il tema restano nel browser (`localStorage`). Le domande all'assistente non escono dal dispositivo.
- **Nessun cookie e nessun tracciamento.** Le statistiche di Cloudflare sono spente; si possono accendere solo in modo esplicito, vedi `DEPLOY.md`.
- **Nessuno script, font o foglio di stile da siti esterni.** Il font usato per le immagini di anteprima è incluso nel repository (licenza OFL) e serve solo durante la build.
- **Una sola dipendenza nel sito**, `@resvg/resvg-wasm`, che disegna le immagini di anteprima durante la build e non arriva mai ai visitatori. Le altre due, `ical.js` e `puppeteer-core`, servono solo per le prove.

## 2. I dati della fonte non sono fidati

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

## 3. Intestazioni HTTP (`src/_headers`)

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

## 4. Catena di fornitura

- Versioni esatte e lockfile (`package-lock.json`). Si installa con `npm ci --ignore-scripts`, così nessuna dipendenza esegue codice durante l'installazione. La build di Cloudflare installa solo la dipendenza che le serve (`--omit=dev`): un solo pacchetto, senza dipendenze a cascata. Il file `.npmrc` imposta `ignore-scripts=true` anche per chi usa `npm install`.
- `npm audit`: 0 vulnerabilità alla consegna. Il workflow «Verifica» blocca se ce ne sono di gravità alta o critica.
- **Dependabot** propone ogni settimana gli aggiornamenti di npm e delle azioni GitHub (`.github/dependabot.yml`). Propone una nuova versione solo 7 giorni dopo la sua uscita (`cooldown`): una versione compromessa di solito viene scoperta e ritirata prima. Gli aggiornamenti di sicurezza arrivano subito.

## 5. GitHub Actions

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

## 6. Dominio e DNS

Istruzioni in `DEPLOY.md`, passi 2 e 7-13 (il 16 per Google Search Console). Il dominio `fermitutti.com` è registrato su Cloudflare, nello stesso account del sito: verifica dell'email del titolare, blocco contro i trasferimenti, rinnovo automatico, DNSSEC con il record DS inviato da Cloudflare al registro, record CAA (solo le autorità di Cloudflare), nessun record orfano, DMARC `p=reject`, un solo reindirizzamento da `www` e da `pages.dev` al dominio principale, solo HTTPS e TLS minimo 1.2.

Per la posta ci sono due configurazioni corrette. Nella prima il dominio non usa email: SPF `v=spf1 -all` e MX nullo. Nella seconda riceve soltanto, con l'inoltro gratuito di Cloudflare (Email Routing) dall'indirizzo di contatto alla casella del titolare: i record MX, SPF e DKIM li crea Cloudflare. In tutti e due i casi nessuno può mandare email credibili a nome del dominio.

Il controllo automatico è `npm run verifica-online -- fermitutti.com`, oppure il workflow «Controllo online» su GitHub. Riconosce da solo quale delle due configurazioni di posta è in uso. Controlla anche che Cloudflare non inserisca script nelle pagine (offuscamento delle email, Rocket Loader), che la politica di sicurezza bloccherebbe.

## 7. Account

La verifica in due passaggi su email, GitHub e Cloudflare, che è anche il registrar del dominio, è il **primo passo** di `DEPLOY.md`, con i codici di recupero su carta. Cloudflare riceve accesso solo al repository del sito.

## 8. security.txt

`/.well-known/security.txt` (RFC 9116) viene rigenerato a ogni build con una scadenza a 180 giorni. Siccome il sito si ricostruisce ogni giorno, la scadenza non passa mai. Il contatto arriva dalla variabile `TITOLARE_EMAIL` di Cloudflare Pages oppure da `config/sito.mjs`. Un valore con un a capo o che non è un indirizzo email ferma la build, così nessuno può aggiungere righe al file attraverso quella variabile.

## 9. Aggiornamento dal computer in Italia

Il server del Ministero accetta solo connessioni dall'Italia, quindi i dati li legge un computer in Italia con un timer di systemd dell'utente (`scripts/aggiorna-italia.sh`). Le regole:

- **Codice fisso.** Il timer esegue una copia del codice presa dall'ultimo commit locale al momento dell'installazione, con le sole dipendenze bloccate della build. Il codice che arriva da GitHub non viene mai eseguito sul computer. Chi riuscisse a modificare il repository non potrebbe quindi far girare niente lì.
- **Solo i dati.** Nella copia del repository usata dal timer cambiano e si inviano soltanto `data/scioperi.json` e `data/stato.json`, con la firma «Fermi Tutti». Prima di inviare si costruisce il sito per prova. I dati che arrivano da GitHub passano dagli stessi controlli dell'archivio.
- **Rete di casa.** Se GitHub non risponde lo script si ferma senza toccare niente, così un guasto della rete di casa non viene scambiato per un guasto della fonte.
- **Chiave SSH.** Il timer usa la chiave SSH già presente sul computer. Chi entrasse nel computer potrebbe usarla per modificare il repository: il computer va tenuto aggiornato e protetto come ogni dispositivo personale.
- **Sorveglianza.** GitHub controlla ogni due ore lo stato pubblicato. Se da più di 9 ore non arriva una verifica riuscita, il sito mostra l'avviso ai visitatori e il proprietario riceve una segnalazione. Il sito quindi non può restare fermo in silenzio.

## Come è stato verificato

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

## Revisione indipendente: esito

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

## Rischi che restano

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
