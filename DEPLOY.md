# Come mettere online Fermi Tutti

Questa guida è per chi non ha mai usato GitHub. Segui i passi nell'ordine, senza saltarne. Ogni passo dice cosa fare e come capire se è andato bene.

- **Dominio:** `fermitutti.com`, registrato su Cloudflare l'11 novembre 2026. Usa già i server DNS di Cloudflare.
- **Tempo:** circa un'ora e mezza. Il DNSSEC e Google hanno poi bisogno di qualche giorno.
- **Costo:** solo il rinnovo annuale del dominio. GitHub e Cloudflare Pages sono gratis.
- **Ti servono:** un computer e il tuo telefono.

Le parole che incontrerai:

- **GitHub** è il sito che conserva il codice del sito e ogni 30 minuti fa partire l'aggiornamento automatico degli scioperi.
- **Cloudflare** è il servizio dove hai comprato il dominio. Pubblica anche il sito e lo protegge.
- **DNS** è l'elenco che dice a Internet dove si trova il sito e chi può usare il dominio per le email.
- **Repository** è la cartella del progetto su GitHub.

Nel pannello di Cloudflare i nomi dei menu cambiano spesso. Se non trovi una voce, scrivila nella barra di ricerca in alto nel pannello.

---

## Passo 1. Proteggi gli account (prima di tutto)

Chi ruba uno di questi account può cambiare il tuo sito o rubarti il dominio. Per questo il primo passo è la **verifica in due passaggi**: oltre alla password serve un codice che compare sul tuo telefono.

1. Installa sul telefono un'app di codici, per esempio **Aegis** o **2FAS** (Android) oppure **2FAS** o **Google Authenticator** (iPhone).
2. Usa una password diversa e lunga per ogni account. Il modo più semplice è un gestore di password (per esempio Bitwarden, gratuito).
3. Proteggi prima di tutto **la tua email** con la verifica in due passaggi: è la chiave di tutti gli altri account.
4. Su **Cloudflare**, dove c'è il dominio, vai in *My Profile › Authentication › Two-Factor Authentication* e attivala.
5. Su **GitHub** vai in *Settings › Password and authentication › Two-factor authentication* e attivala.
6. Ogni sito ti mostra dei **codici di recupero**. Scrivili su carta e conservali in un posto sicuro. Senza di loro, se perdi il telefono, perdi l'account.

**Fatto bene se:** entrando in Cloudflare e in GitHub ti viene chiesto anche il codice dell'app.

## Passo 2. Conferma l'email del dominio

Le regole internazionali dei domini (ICANN) obbligano a verificare l'email di chi registra un dominio. Se non la confermi, Cloudflare deve sospendere il dominio e il sito smette di funzionare finché non la confermi.

1. Cerca nella tua casella l'email di verifica di Cloudflare, anche in Spam e Promozioni, e apri il link.
2. Su Cloudflare apri *Domain Registration › Manage Domains*, scegli `fermitutti.com` e apri *Contacts*. Controlla che l'email del titolare sia una casella che leggi davvero.
3. Nella stessa pagina controlla che **Auto-renew** sia attivo. Su Cloudflare lo è di default: il rinnovo parte da solo 30 giorni prima della scadenza.
4. Nella scheda *Configuration* lascia il dominio **bloccato** contro i trasferimenti (*registrar lock*). Si sblocca solo per spostarlo da un'altra parte.

I dati del titolare non sono pubblici: Cloudflare li nasconde nel whois.

**Fatto bene se:** hai aperto il link di verifica e nei *Contacts* c'è la tua email giusta.

## Passo 3. Controlla che il nome sia libero da marchi

Cinque minuti, prima di far conoscere il sito. Le istruzioni sono in `DOMINIO.md`, sezione «Possibili conflitti con altri nomi».

## Passo 4. Metti il codice su GitHub

La cartella del progetto è già pronta, con tutto il necessario e con i salvataggi (commit) fatti finora. Il file con le istruzioni originali (`PROMPT_FABLE.md`) e le cartelle temporanee **non** vengono pubblicate: lo impedisce il file `.gitignore`.

**Non** caricare i file trascinandoli nella pagina di GitHub: si perderebbero le cartelle nascoste, come `.github`, e si pubblicherebbero file che devono restare sul tuo computer.

1. Apri https://github.com/new e compila così:
   - *Repository name*: `fermitutti`;
   - visibilità **Public**. Su GitHub i minuti di calcolo sono gratis e illimitati solo per i repository pubblici, e l'aggiornamento automatico ne usa parecchi;
   - **non** aggiungere README, licenza o `.gitignore`.
2. Premi *Create repository*.
3. Manda il codice. Il computer è già collegato a GitHub con una chiave SSH come utente `13dai12`. Nel terminale, dentro la cartella del progetto, scrivi:

```
git remote add origin git@github.com:13dai12/fermitutti.git
git push -u origin main
```

Se usi Claude Code, dopo aver creato il repository puoi chiedergli di fare lui questi due comandi.

Se il repository è su un altro account GitHub, sostituisci `13dai12` con quel nome utente, qui e nella riga `repository` di `config/sito.mjs`.

**Fatto bene se:** aprendo https://github.com/13dai12/fermitutti vedi le cartelle `scripts`, `src`, `data` e il file `DEPLOY.md`.

I commit risultano firmati «Fermi Tutti», non con il tuo nome. Puoi lasciarlo così.

## Passo 5. Scrivi i tuoi dati nel sito

Finché restano dei segnaposto, Cloudflare si rifiuta di pubblicare il sito: la privacy e le note legali sarebbero incomplete. Se usi Claude Code, dagli nome ed email e li scrive lui.

1. Su GitHub apri il file `config/sito.mjs` e premi la matita (*Edit this file*).
2. Sostituisci i segnaposto tra parentesi quadre:
   - `[NOME E COGNOME DEL TITOLARE]`: il nome di chi gestisce il sito, che comparirà nella privacy e nelle note legali. Le regole sulla privacy chiedono il nome vero. L'indirizzo di casa non serve;
   - `[EMAIL DI CONTATTO]`, che compare due volte: l'indirizzo per le segnalazioni. Sarà **visibile a tutti** sul sito. Per non mostrare la tua email personale scrivi `contatti@fermitutti.com` e attiva l'inoltro gratuito al passo 12: le email ti arriveranno nella tua casella;
   - `partitaIva`: lasciala vuota se non hai partita IVA.
3. Premi *Commit changes*.

**Fatto bene se:** nel file non resta nessun testo tra parentesi quadre.

Da questo momento l'aggiornamento automatico parte già da solo su GitHub, anche se il sito non è ancora online: è normale.

## Passo 6. Le protezioni di GitHub

Tutte gratuite per i repository pubblici. Apri il repository e vai in *Settings*.

1. **Protezione del ramo principale.** In *Rules › Rulesets › New ruleset › New branch ruleset*:
   - *Ruleset name*: `protezione main`; *Enforcement status*: **Active**;
   - *Target branches*: *Add target › Include default branch*;
   - spunta **Restrict deletions** e **Block force pushes**, poi *Create*.
   - Non attivare «Require a pull request before merging»: impedirebbe all'aggiornamento automatico di salvare i dati.
2. **Analisi di sicurezza.** In *Security › Advanced Security* (in alcune versioni si chiama *Code security*) attiva:
   - **Dependency graph**, **Dependabot alerts** e **Dependabot security updates**;
   - **Secret scanning** e **Push protection**, che bloccano password o chiavi finite per sbaglio nel codice;
   - **CodeQL analysis › Set up › Default**, che cerca errori di sicurezza nel codice.
3. **Permessi delle Actions.** In *Actions › General*:
   - in *Approval for running fork pull request workflows* scegli **Require approval for all external contributors**: il codice proposto da sconosciuti non gira finché non lo approvi tu;
   - in *Workflow permissions* scegli **Read repository contents and packages permissions**: i workflow chiedono da soli solo i permessi che servono;
   - togli la spunta da **Allow GitHub Actions to create and approve pull requests**;
   - premi *Save*.
4. **Proposte di modifica da altre persone.** Il repository è pubblico, quindi chiunque può proporre modifiche (*Pull requests*). **Non unire mai proposte di persone che non conosci**, soprattutto se toccano la cartella `.github`, i file `package.json` e `package-lock.json` o la cartella `scripts`: potrebbero servire a prendere il controllo del sito. Le uniche proposte da unire, se il controllo è verde, sono quelle di Dependabot.
5. **Avvisi via email.** Dalla tua foto in alto a destra vai in *Settings › Notifications*. In *Watching*, *Participating* e *Actions* controlla che sia attiva l'email: così ti arrivano gli avvisi se l'aggiornamento si blocca.

## Passo 7. Controlla il DNS del dominio

Il dominio è registrato su Cloudflare, quindi usa già i server DNS di Cloudflare. Non devi cambiare i nameserver.

1. Su Cloudflare apri il dominio `fermitutti.com` e vai in *DNS › Records*.
2. L'elenco deve essere vuoto: lo era l'11 novembre 2026. Se trovi record che non hai creato tu, cancellali. Quelli che servono li aggiungerai nei passi seguenti.

## Passo 8. Pubblica il sito con Cloudflare Pages

1. Su Cloudflare vai in *Workers & Pages › Create application*, scegli **Pages** e poi **Connect to Git**. In alcune versioni del pannello il pulsante si chiama *Import an existing Git repository*.
2. Scegli **GitHub** e autorizza Cloudflare. Quando te lo chiede, dagli accesso **solo** al repository `fermitutti` (*Only select repositories*), poi premi *Install & Authorize*.
3. Scegli il repository `fermitutti`, premi *Begin setup* e compila così:
   - *Project name*: `fermitutti`
   - *Production branch*: `main`
   - *Framework preset*: **None**
   - *Build command*: `npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm run build`
   - *Build output directory*: `public`
   - *Root directory*: lascia vuoto
4. Premi *Save and Deploy* e aspetta un paio di minuti. Se la build si ferma con «segnaposto ancora da compilare», torna al passo 5.
5. Cloudflare crea anche un indirizzo tecnico, per esempio `fermitutti.pages.dev`. Segnatelo: serve al passo 9. Aprilo solo per controllare che il sito funzioni e **non condividerlo**: il sito vero è solo il dominio. Google non lo indicizzerà, perché quell'indirizzo risponde con «noindex» e ogni pagina indica il dominio come indirizzo principale.
6. Per non sprecare build: nel progetto apri *Settings › Builds & deployments*. In **Preview branch control** scegli **None**, lascia attiva la pubblicazione automatica del ramo principale e salva.
7. Nel progetto apri *Custom domains › Set up a custom domain*, scrivi `fermitutti.com` e conferma. Il dominio è nello stesso account, quindi Cloudflare crea da solo il record DNS che serve.

**Fatto bene se:** dopo qualche minuto `https://fermitutti.com` mostra il sito.

## Passo 9. Un solo indirizzo: da www e da pages.dev al dominio

Google deve trovare il sito in un solo posto. Per questo `www.fermitutti.com` e l'indirizzo tecnico `pages.dev` devono portare a `https://fermitutti.com`.

1. Su Cloudflare, nel dominio `fermitutti.com`, vai in *DNS › Records › Add record*:
   - *Type*: `A`
   - *Name*: `www`
   - *IPv4 address*: `192.0.2.1` (è un indirizzo finto: serve solo a far passare la richiesta da Cloudflare)
   - *Proxy status*: **Proxied** (nuvola arancione)
2. Cerca **Bulk Redirects** nel pannello e crea una lista (*Create a list*, tipo *Redirect*) con due righe. In tutte e due scrivi *Target URL* `https://fermitutti.com`, *Status* `301`, e spunta *Preserve query string*, *Subpath matching*, *Preserve path suffix* e *Include subdomains*:
   - prima riga, *Source URL*: `www.fermitutti.com`;
   - seconda riga, *Source URL*: l'indirizzo tecnico del passo 8, per esempio `fermitutti.pages.dev`.
3. Crea la regola (*Create Bulk Redirect Rule*) che usa quella lista e attivala.

**Fatto bene se:** aprendo `https://www.fermitutti.com/citta/` o `https://fermitutti.pages.dev/citta/` finisci su `https://fermitutti.com/citta/`.

## Passo 10. HTTPS e TLS

Nel dominio su Cloudflare vai in *SSL/TLS*.

1. In *Overview* scegli la modalità **Full (strict)**.
2. In *Edge Certificates* imposta:
   - **Always Use HTTPS**: attivo;
   - **Minimum TLS Version**: **TLS 1.2**;
   - **TLS 1.3**: attivo;
   - **Automatic HTTPS Rewrites**: attivo.
3. **Non** attivare l'HSTS da questa pagina: il sito lo invia già da solo, con il file `_headers`. Attivarlo anche qui creerebbe un doppione.
4. **Spegni le funzioni che modificano le pagine.** Cercale con la barra di ricerca del pannello, dentro il dominio:
   - **Email Address Obfuscation**: spenta. Altrimenti Cloudflare nasconde l'indirizzo email delle pagine Contatti e Privacy con uno script che la politica di sicurezza del sito blocca, e i visitatori vedrebbero «[email protected]».
   - **Rocket Loader**: spento.
   - **Bot Fight Mode**: lascialo spento. Inserisce script nelle pagine e per un sito statico non serve.

   Il controllo del passo 15 verifica che nelle pagine non ci siano script aggiunti da Cloudflare.

## Passo 11. DNSSEC (protegge il dominio da deviazioni)

1. Su Cloudflare, nel dominio, vai in *DNS › Settings* e premi **Enable DNSSEC**.
2. Non devi copiare niente altrove. Il dominio è registrato su Cloudflare, quindi Cloudflare comunica da solo al registro del `.com` il «record DS», il dato che collega le firme al dominio.
3. Lo stato diventa **Active** in uno o due giorni.

## Passo 12. Email: indirizzo per i contatti e protezione contro le email false

Il sito non manda email. Con questi record dici a tutto il mondo che **ogni email «da @fermitutti.com» è falsa**, e che solo le autorità usate da Cloudflare possono emettere certificati per il tuo dominio.

**In ogni caso**, su Cloudflare *DNS › Records › Add record*, crea questi due record:

| Type | Name | Contenuto | A cosa serve |
|---|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s` | Le email false a nome tuo vanno rifiutate |
| CAA | `@` | Tag **Only allow specific hostnames**, CA domain name `letsencrypt.org` | Solo autorità scelte possono emettere certificati |

Basta un solo record CAA: appena ne crei uno, Cloudflare aggiunge da sola, in modo invisibile, quelli delle altre autorità che usa per i tuoi certificati (Google Trust Services, SSL.com, Sectigo). Così il rinnovo automatico dei certificati continua a funzionare.

Poi scegli **una** delle due strade, a seconda dell'email che hai scritto al passo 5.

### Strada A: hai scritto `contatti@fermitutti.com` (consigliata)

Cloudflare inoltra gratis alla tua casella le email che arrivano a quell'indirizzo. Sul sito compare solo `contatti@fermitutti.com`, e la pagina della privacy spiega da sola che le email passano dall'inoltro di Cloudflare.

1. Cerca **Email Routing** nel pannello, scegli il dominio `fermitutti.com` e avvia la configurazione (*Onboard Domain* oppure *Get started*).
2. Cloudflare mostra i record DNS che aggiungerà: MX, SPF e DKIM. Conferma e lascia che li crei lui. Non creare tu record MX o SPF.
3. In *Destination addresses* scrivi la tua email personale. Ti arriva un'email: premi **Verify email address**.
4. In *Routing rules* premi *Create routing rule*: *Email pattern* `contatti`, *Action* **Send to an email**, *Destination* la tua email. Premi *Save*.
5. Prova: da un'altra casella manda un'email a `contatti@fermitutti.com`. Deve arrivarti entro un paio di minuti.

Se rispondi dalla tua casella personale, chi riceve la risposta vede il tuo indirizzo personale.

### Strada B: hai scritto un altro indirizzo

Il dominio non riceve e non manda email. Aggiungi questi due record:

| Type | Name | Contenuto | A cosa serve |
|---|---|---|---|
| TXT | `@` | `v=spf1 -all` | Nessun server può mandare email a nome tuo |
| MX | `@` | Mail server: `.` (solo un punto), Priority: `0` | Il dominio non riceve email |

## Passo 13. Controlla che non restino record DNS inutili

In *DNS › Records* devono esserci **solo**:

- il record del sito creato da Cloudflare Pages per `fermitutti.com` (tipo CNAME, verso `...pages.dev`);
- il record `A` di `www` del passo 9;
- i record DMARC e CAA del passo 12 (il CAA che hai creato tu: quelli aggiunti da Cloudflare non si vedono nell'elenco);
- con la strada A: i record MX, SPF e DKIM creati da Email Routing (contengono `mx.cloudflare.net` o `_domainkey`);
- con la strada B: il record SPF `v=spf1 -all` e l'MX con il punto;
- il record TXT `google-site-verification` del passo 16, quando lo avrai fatto.

Se c'è altro, cancellalo. Ogni record che punta a un servizio che non usi è una porta che qualcuno potrebbe aprire.

## Passo 14. Avvia l'aggiornamento automatico

1. Su GitHub apri la scheda **Actions** del repository. Se GitHub chiede di attivare i workflow, conferma.
2. A sinistra scegli **Aggiorna gli scioperi**, poi *Run workflow › Run workflow*.
3. Dopo un minuto o due l'esecuzione diventa verde. Se i dati sono cambiati, compare un nuovo commit «Dati aggiornati» e Cloudflare ripubblica il sito da solo.

Da questo momento l'aggiornamento parte da solo **ogni 30 minuti**. Il sito si ripubblica quando cambiano i dati, ogni notte dopo la mezzanotte e comunque almeno ogni 6 ore.

Una regola di GitHub disattiva i workflow programmati nei repository pubblici dopo 60 giorni senza attività. Qui non succede, perché il sito salva i dati almeno ogni 6 ore e ogni salvataggio conta come attività.

## Passo 15. Controllo finale

1. Su GitHub apri *Actions › Controllo online › Run workflow*. Il dominio `fermitutti.com` è già scritto: premi il pulsante verde.
2. Apri l'esecuzione: ogni riga deve avere il segno ✔.

Se una riga ha ✘:

- **HTTPS o intestazioni**: il dominio non punta ancora al sito, oppure il passo 8 non è finito. Aspetta qualche minuto e riprova.
- **www**: rivedi il passo 9.
- **DNSSEC**: può volerci un giorno o due; se dopo 48 ore è ancora ✘, rivedi il passo 11.
- **SPF, DMARC, MX o CAA**: rivedi il passo 12.
- **TLS minimo 1.2**: rivedi il passo 10.
- **security.txt**: c'è ancora un segnaposto in `config/sito.mjs` (passo 5).
- **Cloudflare non modifica le pagine**: rivedi il punto 4 del passo 10.
- **Pagina inesistente sotto /widget/**: il sito non è aggiornato all'ultima versione; aspetta la ripubblicazione e riprova.

Chi ha Node.js sul computer può fare lo stesso controllo con `npm run verifica-online -- fermitutti.com`.

## Passo 16. Fatti trovare da Google e da Bing (indicizzazione)

Il sito è già pronto per i motori di ricerca, senza fare altro:

- ogni pagina ha un titolo, una descrizione e l'indirizzo principale su `fermitutti.com`;
- la mappa del sito (`sitemap.xml`) elenca tutte le pagine utili e si aggiorna a ogni pubblicazione;
- l'indirizzo tecnico `pages.dev` è escluso da Google e porta al dominio;
- le pagine degli scioperi descrivono data, luogo e stato in un formato che Google legge (dati strutturati).

Google trova i siti nuovi da solo, ma ci mette settimane. Con questi passi lo avvisi subito.

### Google Search Console

1. Apri https://search.google.com/search-console con il tuo account Google e premi *Aggiungi proprietà*.
2. Scegli il tipo **Dominio**, scrivi `fermitutti.com` e premi *Continua*. Google ti mostra un record TXT che inizia con `google-site-verification=`: copialo.
3. Su Cloudflare, nel dominio, vai in *DNS › Records › Add record*: *Type* `TXT`, *Name* `@`, *Content* il testo copiato. Salva.
4. Torna su Search Console e premi *Verifica*. Se non funziona subito, riprova dopo qualche minuto. **Non cancellare** quel record TXT: serve a restare verificato.
5. Nel menu a sinistra apri **Sitemap**, scrivi `https://fermitutti.com/sitemap.xml` e premi *Invia*. Dopo qualche ora lo stato deve diventare «Operazione riuscita».
6. In alto, nella barra *Controlla URL*, incolla `https://fermitutti.com/` e premi *Richiedi indicizzazione*. Fai lo stesso per due o tre pagine importanti, per esempio `https://fermitutti.com/citta/roma/` e `https://fermitutti.com/citta/milano/`. Google permette poche richieste al giorno: non servono per tutte le pagine, ci pensa la sitemap.

### Bing (e i motori che usano Bing, come DuckDuckGo ed Ecosia)

1. Apri https://www.bing.com/webmasters e accedi.
2. Scegli **Importa** da Google Search Console e seleziona `fermitutti.com`. Bing copia la verifica e la sitemap.

### Facoltativo: avvisi automatici a Bing quando cambia una pagina

Su Cloudflare, nel dominio, cerca **Crawler Hints** e attivalo. Quando una pagina cambia, Cloudflare avvisa Bing e gli altri motori che usano il protocollo IndexNow. Google non lo usa: per Google basta la sitemap.

### Come capire se funziona

- Dopo due o tre giorni cerca `site:fermitutti.com` su Google: compaiono le pagine già indicizzate.
- In Search Console, la sezione **Pagine** mostra quante pagine sono indicizzate e perché alcune non lo sono. Le pagine `/widget/` sono escluse apposta: servono solo dentro altri siti. Nei primi giorni è normale vedere molte pagine «rilevate» ma non ancora indicizzate.
- Per controllare i dati strutturati di uno sciopero, incolla l'indirizzo della sua pagina in https://search.google.com/test/rich-results.

Un dominio nuovo ha bisogno di qualche settimana per comparire bene nelle ricerche più comuni, come «sciopero treni domani». **Non pagare** servizi che promettono indicizzazione o link: non servono e possono far penalizzare il sito.

## Passo 17 (facoltativo, dopo un mese). HSTS preload

Quando tutto funziona da almeno un mese, puoi chiedere ai browser di usare **sempre** HTTPS per il tuo dominio, anche alla prima visita.

È difficile da annullare: fallo solo se il sito funziona bene in HTTPS e non pensi di cambiare dominio.

1. Su GitHub modifica `src/_headers`. Nella riga `Strict-Transport-Security` aggiungi `; preload` alla fine, così: `max-age=63072000; includeSubDomains; preload`.
2. Aspetta che Cloudflare ripubblichi il sito, poi su https://hstspreload.org scrivi `fermitutti.com` e premi *Check HSTS preload status and eligibility*. Invia la richiesta solo se il controllo non segnala errori.

---

## Guadagnare con i link di affiliazione

Tutti i codici stanno in `config/affiliati.mjs`. Ogni voce ha un commento in italiano. **Se un codice è vuoto, il riquadro non compare.** Se un codice è scritto male, la build si ferma con un messaggio che spiega cosa correggere, e il sito online resta com'era.

1. **AirHelp** (rimborsi dei voli): iscriviti al programma affiliati su https://www.airhelp.com/en-int/affiliate/. Quando ti approvano, copia il tuo link completo nel campo `airhelp.link`.
   - Il riquadro compare solo nelle pagine degli scioperi aerei.
   - La frase «potrebbero spettarti da 250 a 600 euro» compare solo quando sciopera il personale di una compagnia aerea. Negli altri casi c'è un testo neutro con il link al sito dell'Unione europea.
2. **FlixBus** (alternative di viaggio): iscriviti come editore su Awin (https://www.awin.com/it), poi chiedi di partecipare al programma «Flixbus IT» (https://ui.awin.com/merchant-profile/110876). Il tuo numero di editore Awin va in `flixbus.awinAffid`.
3. **Noleggio auto** (facoltativo): incolla il link affiliato di uno dei fornitori ammessi e il suo nome.

Per modificare il file su GitHub: aprilo, premi la matita, cambia, premi *Commit changes*. Cloudflare ripubblica il sito in un paio di minuti.

I guadagni da affiliazione vanno dichiarati: chiedi a un commercialista come farlo nel tuo caso.

## Pubblicità (non attiva)

C'è solo uno spazio predisposto e spento (`pubblicita.attiva: false` in `config/affiliati.mjs`). **Non attivarlo da solo.** Per mostrare pubblicità di Google ai visitatori europei serve una **piattaforma di gestione del consenso certificata da Google** (un banner dei cookie conforme alle regole IAB TCF). Bisogna anche aggiornare la privacy e permettere gli script pubblicitari nella politica di sicurezza (`src/_headers`). È un lavoro da fare con uno sviluppatore.

## Statistiche senza cookie (facoltative, spente)

1. Su Cloudflare apri il progetto Pages, scheda *Metrics*, e attiva **Web Analytics**.
2. Su GitHub, in `config/sito.mjs`, metti `statisticheCloudflare: true`.

Il sito permetterà così solo lo script di Cloudflare, e la pagina della privacy lo dichiarerà da sola. Queste statistiche non usano cookie.

---

## Se il sito smette di aggiornarsi

Il sito non pubblica mai dati che sembrano sbagliati. In alto nelle pagine compare un avviso se la fonte non risponde o se i dati hanno più di 8 ore. Quando qualcosa non va, su GitHub si apre una **segnalazione** (scheda *Issues*) e ti arriva un'email.

- **«La fonte ufficiale degli scioperi non funziona».**
  - Di solito si risolve da sola: il sito del Ministero è giù o lento. La segnalazione si chiude da sola quando la fonte torna.
  - Se dura più di un giorno, apri https://scioperi.mit.gov.it/mit2/public/scioperi nel browser. Se lì funziona, probabilmente il Ministero ha cambiato il formato dei dati e serve una modifica al codice. Chiedi a uno sviluppatore oppure a Claude Code, partendo da `NOTE_PROGETTO.md`.
  - Se il messaggio dice **«numero di scioperi crollato»**, **«cresciuto in modo anomalo»** o **«troppi scioperi nuovi»**, controlla a mano sul sito del Ministero. Se il numero è davvero cambiato così, vai in *Actions › Aggiorna gli scioperi › Run workflow*, spunta **Accetta un calo o un aumento improvviso** e avvia.
  - Se il messaggio dice **«i dati nuovi non si possono pubblicare»**, un dato del Ministero è scritto in un modo che il sito non sa ancora gestire. Il sito resta com'era. Serve una piccola modifica al codice: chiedi a uno sviluppatore oppure a Claude Code, incollando il messaggio.
- **«Il controllo automatico si è fermato».** Apri il link nella segnalazione e guarda il punto rosso. Se l'errore si ripete, serve uno sviluppatore.
- **«La build del sito non funziona con i dati nuovi».** Cloudflare continua a mostrare l'ultima versione buona. Serve uno sviluppatore. Su Cloudflare, nel progetto, la scheda *Deployments* mostra il messaggio d'errore.
- **Nessuna segnalazione, ma il sito dice che i dati sono vecchi.** Apri *Actions › Aggiorna gli scioperi*. Se vedi «This scheduled workflow is disabled», premi **Enable workflow**. Se GitHub ha problemi (https://www.githubstatus.com), aspetta.

## Manutenzione ordinaria

Circa 10 minuti al mese.

- **Aggiornamenti delle dipendenze.** Dependabot apre delle proposte (scheda *Pull requests*). Se il controllo «Verifica» è verde, premi *Merge pull request*. Se è rosso, non unire e chiedi a uno sviluppatore. Meglio aspettare qualche giorno dall'uscita della nuova versione prima di unire.
- **Fasce garantite.** Una volta l'anno ricontrolla i link in `data/fasce_garanzia.json`: le aziende cambiano pagine e regole. Ogni voce ha la data di verifica.
- **Dominio.** Il rinnovo è automatico, ma controlla che la carta di pagamento su Cloudflare sia valida. Se un rinnovo non riesce, Cloudflare ti scrive e riprova.
- **Search Console.** Una volta al mese guarda se ci sono avvisi o errori.

## Costi e limiti gratuiti

| Servizio | Costo | Limite gratuito | Uso previsto |
|---|---|---|---|
| Dominio `.com` (Cloudflare) | Il rinnovo annuale: Cloudflare fa pagare il prezzo del registro, senza ricarichi | | |
| GitHub (repository pubblico) | 0 | Minuti di Actions illimitati per i repository pubblici | Circa 50 esecuzioni al giorno, un minuto ciascuna |
| Cloudflare Pages | 0 | 500 build al mese, 20.000 file | Da 120 a 250 build al mese (dati cambiati più una ogni 6 ore); da 350 a circa 800 file |
| Email Routing di Cloudflare | 0 | | Solo se scegli la strada A del passo 12 |

## Provare il sito sul proprio computer (facoltativo)

Serve Node.js 22 o più recente.

```
npm ci --ignore-scripts
npm test
npm run build
npm run servi
```

Poi apri http://127.0.0.1:8080/ nel browser.
