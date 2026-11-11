# Fermi Tutti

Sito che risponde a una sola domanda: **lo sciopero tocca me, e quando?** Scioperi dei trasporti in Italia (treni, aerei, bus e metro, traghetti, taxi), presi ogni 30 minuti dal calendario ufficiale del Ministero delle Infrastrutture e dei Trasporti. Sito statico, senza server, senza login, senza cookie.

- **Mettere online il sito:** `DEPLOY.md`
- **Nome e dominio:** `DOMINIO.md`
- **Sicurezza:** `SICUREZZA.md`
- **Decisioni e lezioni (da leggere prima di modificare il codice):** `NOTE_PROGETTO.md`

## Comandi

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

## Struttura

| Cartella o file | Contenuto |
|---|---|
| `config/sito.mjs` | Nome e dominio. Nome ed email del titolare arrivano dalle variabili `TITOLARE_NOME` e `TITOLARE_EMAIL` di Cloudflare Pages |
| `config/affiliati.mjs` | Codici di affiliazione, spenti di default |
| `data/scioperi.json` | Archivio degli scioperi, aggiornato dal workflow |
| `data/stato.json` | Stato dei controlli sulla fonte |
| `data/fasce_garanzia.json` | Fasce garantite ufficiali, con citazione, fonte e data di verifica |
| `data/assistente.json` | Parole chiave e risposte dell'assistente |
| `data/luoghi.json` | Regioni e città |
| `data/settori.json` | Settori del Ministero e come li mostriamo |
| `scripts/aggiorna.mjs` | Aggiornamento dei dati (nessuna dipendenza esterna) e sorveglianza da GitHub |
| `scripts/aggiorna-italia.sh` | Lo script che il timer del computer in Italia avvia ogni 30 minuti |
| `scripts/build.mjs` | Generazione del sito |
| `scripts/lib/` | Lettura del feed, validazione, archivio, pagine, calendari, immagini |
| `src/` | CSS, intestazioni (`_headers`) e JavaScript del browser (`src/js/`, condiviso con la build) |
| `test/` | Prove automatiche (`node --test`) |
| `.github/workflows/` | Sorveglianza dell'aggiornamento, verifica del codice, controllo online |

I dati degli scioperi sono del Ministero delle Infrastrutture e dei Trasporti (licenza CC BY 3.0 IT), rielaborati. Il sito non è ufficiale.
