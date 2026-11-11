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

- **Lettura.** Il feed viene rifiutato se non è RSS, se supera i 5 MB o se contiene dichiarazioni `DOCTYPE` o `ENTITY`. Vengono tolti i tag, i caratteri di controllo e quelli invisibili o che cambiano la direzione del testo. Il download segue i reindirizzamenti solo verso lo stesso sito ed è interrotto oltre i 5 MB anche senza `Content-Length` (`scripts/lib/feed.mjs`, `scripts/aggiorna.mjs`).
- **Validazione rigorosa** (`scripts/lib/valida.mjs`).
  - Rifiuta l'aggiornamento se mancano campi obbligatori o se un codice non ha il formato del Ministero.
  - Rifiuta date impossibili o incoerenti, campi troppo lunghi e codici duplicati.
  - Rifiuta il feed se **un qualsiasi campo contiene markup o link `javascript:`**: il Ministero non li usa mai.
  - Rifiuta il feed se troppi settori sono sconosciuti, segno che il formato è cambiato.
  - Rifiuta il feed se il numero di scioperi crolla a meno della metà rispetto a quelli ancora validi.
- **Se qualcosa non torna non si pubblica nulla.** Restano gli ultimi dati validi, il sito mostra un avviso onesto e su GitHub si apre una segnalazione che ti arriva per email.
- **Escape per ogni contesto.**
  - HTML e attributi: `e()` in `scripts/lib/html.mjs`.
  - Link: `urlSicuro()` accetta solo percorsi interni, `https:`, `webcal:` e `mailto:`. I link non vengono **mai** presi dai dati del Ministero.
  - JSON nei dati strutturati: `jsonPerScript()` impedisce di chiudere il tag `</script>`.
  - Testo dei calendari: escape RFC 5545, righe ripiegate a 75 byte, ritorni a capo neutralizzati.
- **Nel browser** il codice non usa mai `innerHTML`, `eval` o simili: solo `createElement` e `textContent`. Lo garantisce anche il browser stesso, grazie a **Trusted Types** nella politica di sicurezza: un'eventuale scrittura di HTML da testo verrebbe bloccata.
- **Difesa in profondità alla build.** Anche se dati malevoli arrivassero nell'archivio, la build rifiuta campi con `<` o `>`, indirizzi di pagina non validi e stati sconosciuti (`validaArchivio` in `scripts/build.mjs`).

## 3. Intestazioni HTTP (`src/_headers`)

- **Content-Security-Policy**: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`, `upgrade-insecure-requests`, `require-trusted-types-for 'script'`, `trusted-types 'none'`. Nessun `'unsafe-inline'` e nessun `'unsafe-eval'`; nel sito non ci sono script né stili in linea.
- **Strict-Transport-Security**: 2 anni con `includeSubDomains`. Il `preload` è lasciato fuori di proposito: va aggiunto solo dopo aver visto che tutto funziona in HTTPS (passo 16 di `DEPLOY.md`).
- **Altre intestazioni:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (contro il clickjacking), `Referrer-Policy: strict-origin-when-cross-origin`, una `Permissions-Policy` che spegne fotocamera, microfono, posizione, pagamenti e simili, e `Cross-Origin-Opener-Policy: same-origin`.
- **Unica eccezione: il widget** (`/widget/*`), che deve potersi incorporare in altri siti.
  - Per quel percorso si tolgono solo `Content-Security-Policy` e `X-Frame-Options`.
  - La pagina del widget porta la sua politica in un tag `<meta>`: `default-src 'none'`, nessuno script.
  - `frame-ancestors` non si può mettere in un `<meta>`, quindi l'incorporamento resta permesso.
  - Nessuna regola toglie e reimposta la stessa intestazione, un caso che la documentazione di Cloudflare non chiarisce.
- **Nessun redirect aperto.** Il sito non ha pagine che reindirizzano verso indirizzi presi dalla richiesta. Il parametro `?d=` dell'assistente riempie solo il campo della domanda. L'unico reindirizzamento (`www` verso il dominio principale) è fisso e configurato in Cloudflare.

## 4. Catena di fornitura

- Versioni esatte e lockfile (`package-lock.json`). Si installa con `npm ci --ignore-scripts`, così nessuna dipendenza esegue codice durante l'installazione. La build di Cloudflare installa solo la dipendenza che le serve (`--omit=dev`): un solo pacchetto, senza dipendenze a cascata. Il file `.npmrc` imposta `ignore-scripts=true` anche per chi usa `npm install`.
- `npm audit`: 0 vulnerabilità alla consegna. Il workflow «Verifica» blocca se ce ne sono di gravità alta o critica.
- **Dependabot** propone ogni settimana gli aggiornamenti di npm e delle azioni GitHub (`.github/dependabot.yml`).

## 5. GitHub Actions

- Tutte le azioni sono **bloccate al commit SHA completo** (`actions/checkout` v7.0.1, `actions/setup-node` v7.1.0); Dependabot le aggiorna.
- `permissions: {}` come impostazione predefinita, e ogni lavoro chiede solo i permessi che usa.
- **Il lavoro che può scrivere nel repository esegue solo `scripts/aggiorna.mjs`**, che usa Node.js e **nessuna** dipendenza esterna.
  - Le dipendenze npm girano solo nel lavoro di prova, che può solo leggere.
  - Le segnalazioni le apre un terzo lavoro che ha solo il permesso sulle issue.
- `persist-credentials: false` in ogni checkout. Il token si usa una sola volta, per il push, passato in un'intestazione: non resta nella configurazione di git.
- Nessun `pull_request_target` e nessun `workflow_run`. Timeout su ogni lavoro. `concurrency` per evitare esecuzioni sovrapposte.
- **Nessuna espressione `${{ }}` dentro gli script**: tutti i valori passano da variabili d'ambiente, contro l'iniezione di comandi. Il testo dei messaggi d'errore, che può contenere frammenti della fonte, viene ripulito e limitato a 900 caratteri prima di finire in una segnalazione.
- Queste regole sono controllate automaticamente da `test/workflow.test.mjs`.
- In `DEPLOY.md` (passo 6) ci sono le istruzioni per la protezione del ramo principale, il secret scanning, la push protection, Dependabot e CodeQL.

## 6. Dominio e DNS

Istruzioni in `DEPLOY.md`, passi 3 e 7-13: DNSSEC, protezione contro il trasferimento presso il registrar, record CAA (solo le autorità di Cloudflare), nessun record orfano, SPF `v=spf1 -all`, DMARC `p=reject`, MX nullo, un solo reindirizzamento da `www` al dominio principale, solo HTTPS e TLS minimo 1.2.

Il controllo automatico è `npm run verifica-online -- fermitutti.it`, oppure il workflow «Controllo online» su GitHub.

## 7. Account

La verifica in due passaggi su email, registrar, GitHub e Cloudflare è il **primo passo** di `DEPLOY.md`, con i codici di recupero su carta. Cloudflare riceve accesso solo al repository del sito.

## 8. security.txt

`/.well-known/security.txt` (RFC 9116) viene rigenerato a ogni build con il contatto preso da `config/sito.mjs` e una scadenza a 180 giorni. Siccome il sito si ricostruisce ogni giorno, la scadenza non passa mai.

## Come è stato verificato

| Verifica | Risultato |
|---|---|
| `npm test`: 278 prove su parser, validazione, archivio, aggiornamento, calendari, sicurezza, build, workflow e assistente | 278 superate |
| Dati malevoli nel feed: tag `<script>`, `<img onerror>`, link `javascript:`, markup nel titolo, `DOCTYPE`/`ENTITY`, CRLF, caratteri di direzione e invisibili, campi da 20.000 caratteri, reindirizzamento verso un altro sito | Rifiutati, oppure ripuliti nel caso di CRLF e unicode strano; i dati restano intatti |
| Fonte guasta (12 scenari, anche sui dati reali): errore 500, nessuna risposta, pagina HTML, feed vuoto, campi mancanti, date impossibili, calo improvviso | Nessuna pubblicazione di dati sbagliati; la prima segnalazione viene pubblicata, le successive no |
| Calendari validati con la libreria `ical.js` e controlli puntuali (CRLF, righe di al massimo 75 byte, UTF-8 integro, una sola `VEVENT` anche con testo che prova a iniettarne un'altra) | Tutti validi |
| Chromium senza finestra, a 360 px e a 1280 px, tema chiaro e scuro, con le intestazioni reali applicate da un server locale | Nessun errore in console, nessuna violazione della CSP o di Trusted Types, nessuno scorrimento orizzontale |
| Lighthouse 13.6, modalità mobile, sulla home e su una pagina di sciopero | 100 in prestazioni, accessibilità, buone pratiche e SEO |
| `npm audit` | 0 vulnerabilità |
| Revisione di sicurezza indipendente (un secondo agente con contesto pulito) | Vedi la sezione qui sotto |

## Revisione indipendente

Esito e correzioni sono riportati in fondo a questo file, nella sezione «Revisione indipendente: esito».

## Rischi che restano

- **Account.** Il rischio più grande: chi entra nel tuo account GitHub, Cloudflare, OVHcloud o nella tua email può cambiare il sito o prendersi il dominio. La verifica in due passaggi e i codici di recupero su carta lo riducono molto.
- **Fonte manipolata in modo «plausibile».** Se qualcuno alterasse il sito del Ministero con dati credibili (date e testi normali), il sito li pubblicherebbe, perché non c'è modo di distinguerli da quelli veri. Il danno resta comunque limitato a testo mostrato come testo: nessuno script e nessun link possono passare.
- **Il Ministero non dichiara le revoche.** Uno sciopero che sparisce prima di iniziare viene mostrato come «revocato», ma potrebbe anche essere stato tolto per errore. La spiegazione è sempre visibile e invita a verificare con l'azienda.
- **Workflow mai eseguiti su GitHub.** I workflow sono stati controllati con prove automatiche e a mano, ma non possono girare qui. `actionlint`, lo strumento di verifica dei workflow, non è stato eseguito: scaricarlo ed eseguirlo non era permesso in questa sessione. Al primo avvio (passo 14 di `DEPLOY.md`) controlla che sia tutto verde.
- **Il comportamento di Cloudflare con `_headers`** è stato riprodotto in locale seguendo la documentazione. Dopo il lancio, il workflow «Controllo online» verifica le intestazioni reali, anche quelle del widget.
- **Dipendenze di terzi.** Una dipendenza compromessa potrebbe alterare la build. Il rischio è ridotto da versioni bloccate, `--ignore-scripts`, nessuna dipendenza nel lavoro con permesso di scrittura e revisione delle proposte di Dependabot, ma non è nullo.
- **Calendari iscritti.** Google Calendar può mostrare una revoca con molte ore di ritardo. Il sito lo dice chiaramente e invita a controllare il giorno prima.
- **HSTS preload** non è attivo finché non lo attivi tu (passo 16).
