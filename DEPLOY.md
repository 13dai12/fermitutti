# Come mettere online Fermi Tutti

Questa guida è per chi non ha mai usato GitHub. Segui i passi nell'ordine, senza saltarne. Ogni passo dice cosa fare e come capire se è andato bene.

- **Tempo:** circa due ore in tutto, più un giorno di attesa per il DNS.
- **Costo:** solo il dominio, circa 11 euro l'anno. GitHub e Cloudflare sono gratis.
- **Ti servono:** un computer, il tuo telefono e una carta di pagamento per il dominio.

Le parole che incontrerai:

- **GitHub** è il sito che conserva il codice del sito e ogni 30 minuti fa partire l'aggiornamento automatico degli scioperi.
- **Cloudflare** è il servizio che pubblica il sito e lo protegge.
- **OVHcloud** è il negozio dove compri il dominio `fermitutti.it`. Il perché della scelta è in `DOMINIO.md`.
- **Repository** è la cartella del progetto su GitHub.

---

## Passo 1. Proteggi gli account (prima di tutto)

Chi ruba uno di questi account può cambiare il tuo sito o rubarti il dominio. Per questo il primo passo è la **verifica in due passaggi**: oltre alla password serve un codice che compare sul tuo telefono.

1. Installa sul telefono un'app di codici, per esempio **Aegis** o **2FAS** (Android) oppure **2FAS** o **Google Authenticator** (iPhone).
2. Usa una password diversa e lunga per ogni account. Il modo più semplice è un gestore di password (per esempio Bitwarden, gratuito).
3. Proteggi prima di tutto **la tua email** con la verifica in due passaggi: è la chiave di tutti gli altri account.
4. Crea l'account **GitHub** su https://github.com/signup. Poi vai in *Settings › Password and authentication › Two-factor authentication* e attivala con l'app.
5. Crea l'account **Cloudflare** su https://dash.cloudflare.com/sign-up. Poi vai in *My Profile › Authentication › Two-Factor Authentication* e attivala.
6. Crea l'account **OVHcloud** su https://www.ovhcloud.com/it/. Poi vai in *Il mio account › Sicurezza › Doppia autenticazione* e attivala.
7. Ogni sito ti mostra dei **codici di recupero**. Scrivili su carta e conservali in un posto sicuro. Senza di loro, se perdi il telefono, perdi l'account.

**Fatto bene se:** entrando in ciascun account ti viene chiesto anche il codice dell'app.

## Passo 2. Controlla che il nome sia libero da marchi

Cinque minuti, prima di pagare. Le istruzioni sono in `DOMINIO.md`, sezione «Possibili conflitti con altri nomi».

## Passo 3. Compra il dominio su OVHcloud

1. Vai su https://www.ovhcloud.com/it/domains/ e cerca `fermitutti.it`.
2. Aggiungilo al carrello. **Non aggiungere** hosting, email o altre opzioni: non servono.
3. Completa l'acquisto. Ti chiederanno il codice fiscale: è una regola del Registro .it.
4. Nel pannello di OVHcloud apri *Web Cloud › Domini › fermitutti.it*.
5. Nella scheda *Informazioni generali* controlla che la **Protezione contro il trasferimento** sia **attiva** e che il **rinnovo automatico** sia acceso. Se per il `.it` la protezione non compare, va bene lo stesso: per trasferire un `.it` a un altro registrar serve un codice segreto (AuthInfo) che si ottiene solo dal tuo pannello, protetto dalla verifica in due passaggi.

**Fatto bene se:** il dominio compare nel pannello con la protezione attiva.

## Passo 4. Metti il codice su GitHub

La cartella del progetto è già pronta, con tutto il necessario e con un primo salvataggio (commit). Il file con le istruzioni originali (`PROMPT_FABLE.md`) e le cartelle temporanee **non** vengono pubblicate: lo impedisce il file `.gitignore`.

**Non** caricare i file trascinandoli nella pagina di GitHub: si perderebbero le cartelle nascoste, come `.github`, e si pubblicherebbero file che devono restare sul tuo computer.

### Su Linux (il tuo computer)

Apri un terminale ed entra nella cartella del progetto, cioè quella che contiene questo file `DEPLOY.md` (comando `cd` seguito dal percorso della cartella). Poi scrivi questi comandi uno alla volta.

```
sudo pacman -S github-cli
gh auth login
```

Il comando `gh auth login` fa alcune domande. Rispondi così:

- *Where do you use GitHub?* **GitHub.com**
- *What is your preferred protocol?* **HTTPS**
- *Authenticate Git with your GitHub credentials?* **Yes**
- *How would you like to authenticate?* **Login with a web browser**

Si apre il browser: incolla il codice che vedi nel terminale e conferma. Poi pubblica il progetto:

```
gh repo create fermitutti --public --source=. --push
gh auth logout
```

L'ultimo comando toglie dal computer l'accesso a GitHub, che non serve più: se qualcuno usasse il tuo computer non potrebbe modificare il repository.

Il repository deve essere **pubblico**. Su GitHub i minuti di calcolo sono gratis e illimitati solo per i repository pubblici, e l'aggiornamento automatico ne usa parecchi.

### Su Windows o Mac

Installa **GitHub Desktop** da https://desktop.github.com e accedi con il tuo account. Poi scegli *File › Add local repository*, seleziona la cartella del progetto, premi *Publish repository* e **togli** la spunta da *Keep this code private*.

**Fatto bene se:** aprendo `https://github.com/TUO-NOME/fermitutti` vedi le cartelle `scripts`, `src`, `data` e il file `DEPLOY.md`.

Nota: il primo commit risulta firmato «Fermi Tutti», non con il tuo nome. Puoi lasciarlo così.

## Passo 5. Scrivi i tuoi dati nel sito

1. Su GitHub apri il file `config/sito.mjs` e premi la matita (*Edit this file*).
2. Sostituisci i segnaposto tra parentesi quadre:
   - `[NOME E COGNOME DEL TITOLARE]`: il tuo nome, che comparirà nella privacy e nelle note legali;
   - `[EMAIL DI CONTATTO]`: un indirizzo email a cui vuoi ricevere le segnalazioni (compare due volte). Sarà **visibile a tutti** sul sito: meglio un indirizzo dedicato;
   - `[UTENTE-GITHUB]`: il tuo nome utente GitHub, dentro l'indirizzo del repository;
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

## Passo 7. Porta il dominio su Cloudflare

1. **Prima, su OVHcloud:** apri *Web Cloud › Domini › fermitutti.it* e cerca la voce **DNSSEC** (si chiama anche «Delega sicura»). Se è attiva, **disattivala**. Il DNSSEC di OVHcloud va spento prima di passare a Cloudflare: lo riattiverai con Cloudflare al passo 11. OVHcloud applica il cambio dei server DNS solo dopo questa disattivazione, quindi può servire un giorno in più.
2. Su Cloudflare premi *Add a domain* (oppure *Onboard a domain*), scrivi `fermitutti.it` e scegli il piano **Free**.
3. Cloudflare mostra i record DNS che ha trovato. **Cancellali tutti**: quelli che servono li aggiungerai tu nei passi seguenti. OVHcloud mette record di prova, per la pagina di parcheggio e per la posta, che lasciati lì diventano record «orfani», un rischio di sicurezza.
4. Cloudflare ti dà **due nameserver**, per esempio `anna.ns.cloudflare.com` e `bob.ns.cloudflare.com`.
5. Su OVHcloud apri *Web Cloud › Domini › fermitutti.it › Server DNS › Modifica i server DNS*. Sostituisci quelli di OVHcloud con i due di Cloudflare e conferma.
6. Aspetta l'email di Cloudflare che dice che il dominio è **attivo**. Di solito arriva in qualche ora, al massimo in 24-48 ore.

## Passo 8. Pubblica il sito con Cloudflare Pages

1. Su Cloudflare vai in *Workers & Pages › Create* e scegli la scheda **Pages**, poi *Connect to Git* (o *Import an existing Git repository*).
2. Autorizza Cloudflare su GitHub. Quando te lo chiede, dagli accesso **solo** al repository `fermitutti`.
3. Scegli il repository `fermitutti` e compila così:
   - *Production branch*: `main`
   - *Framework preset*: **None**
   - *Build command*: `npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm run build`
   - *Build output directory*: `public`
   - *Root directory*: lascia vuoto
4. Premi *Save and Deploy* e aspetta un paio di minuti.
5. Il sito è online su un indirizzo provvisorio, per esempio `fermitutti.pages.dev`. Aprilo e controlla che funzioni.
6. Per non sprecare build: nel progetto apri *Settings › Builds & deployments*, cerca le **preview deployments** (anteprime) e scegli **None** (nessuna anteprima).
7. Nel progetto vai in *Custom domains › Set up a domain*, scrivi `fermitutti.it` e conferma. Cloudflare crea da solo il record DNS che serve.

**Fatto bene se:** dopo qualche minuto `https://fermitutti.it` mostra il sito.

## Passo 9. Un solo indirizzo: da www al dominio principale

1. Su Cloudflare, nel dominio `fermitutti.it`, vai in *DNS › Records › Add record*:
   - *Type*: `A`
   - *Name*: `www`
   - *IPv4 address*: `192.0.2.1` (è un indirizzo finto: serve solo a far passare la richiesta da Cloudflare)
   - *Proxy status*: **Proxied** (nuvola arancione)
2. Dal menu principale dell'account vai in *Bulk Redirects* (si trova anche cercando «Bulk Redirects» nel pannello). Crea una lista con una sola riga:
   - *Source URL*: `www.fermitutti.it`
   - *Target URL*: `https://fermitutti.it`
   - *Status*: `301`
   - spunta *Preserve query string*, *Subpath matching*, *Preserve path suffix* e *Include subdomains*.
3. Crea la regola (*Create Bulk Redirect Rule*) che usa quella lista e attivala.

In alternativa, nel dominio puoi usare *Rules › Redirect Rules › Create rule* con il modello **Redirect from WWW to Root**: il risultato è lo stesso.

Facoltativo: il sito resta raggiungibile anche all'indirizzo provvisorio `fermitutti.pages.dev`. Per mandare anche quello al dominio vero, aggiungi alla stessa lista di Bulk Redirects una riga con *Source URL* `fermitutti.pages.dev` e *Target URL* `https://fermitutti.it`, con le stesse spunte.

**Fatto bene se:** aprendo `https://www.fermitutti.it/citta/` finisci su `https://fermitutti.it/citta/`.

## Passo 10. HTTPS e TLS

Nel dominio su Cloudflare vai in *SSL/TLS*.

1. In *Overview* scegli la modalità **Full (strict)**.
2. In *Edge Certificates* imposta:
   - **Always Use HTTPS**: attivo;
   - **Minimum TLS Version**: **TLS 1.2**;
   - **TLS 1.3**: attivo;
   - **Automatic HTTPS Rewrites**: attivo.
3. **Non** attivare l'HSTS da questa pagina: il sito lo invia già da solo, con il file `_headers`. Attivarlo anche qui creerebbe un doppione.
4. **Spegni le funzioni che modificano le pagine.** Cercale con la barra di ricerca del pannello di Cloudflare, dentro il dominio:
   - **Email Address Obfuscation**: spenta. Altrimenti Cloudflare nasconde l'indirizzo email delle pagine Contatti e Privacy con uno script che la politica di sicurezza del sito blocca, e i visitatori vedrebbero «[email protected]».
   - **Rocket Loader**: spento.
   - **Bot Fight Mode**: lascialo spento. Inserisce script nelle pagine e per un sito statico non serve.

   Il controllo del passo 15 verifica che nelle pagine non ci siano script aggiunti da Cloudflare.

## Passo 11. DNSSEC (protegge il dominio da deviazioni)

1. Su Cloudflare, nel dominio, vai in *DNS › Settings* e premi **Enable DNSSEC**. Si apre una finestra con alcuni valori: lasciala aperta.
2. Su OVHcloud apri *Web Cloud › Domini › fermitutti.it* e la scheda **record DS**. La scheda compare solo dopo il passo 7, quando il dominio usa server DNS esterni. Premi *Modifica*, poi **+**, e copia da Cloudflare:
   - *Key Tag*: il numero «Key Tag»;
   - *Flag*: `257`;
   - *Algoritmo*: `13`;
   - *Chiave pubblica*: il testo «Public Key».
3. Conferma. L'attivazione richiede fino a 24 ore. Su Cloudflare lo stato DNSSEC diventerà **Active**.

Se su OVHcloud la scheda «record DS» non compare, scrivi all'assistenza OVHcloud chiedendo di aggiungere il record DS. Non cambiare altre impostazioni.

## Passo 12. Protezione contro le email false e i certificati non autorizzati

Il sito non manda e non riceve email. Questi record dicono a tutto il mondo che **ogni email «da @fermitutti.it» è falsa**, e che solo le autorità usate da Cloudflare possono emettere certificati per il tuo dominio.

Su Cloudflare, *DNS › Records › Add record*, crea uno per uno:

| Type | Name | Contenuto | A cosa serve |
|---|---|---|---|
| TXT | `@` | `v=spf1 -all` | Nessun server può mandare email a nome tuo |
| TXT | `_dmarc` | `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s` | Le email false vanno rifiutate |
| MX | `@` | Mail server: `.` (solo un punto), Priority: `0` | Il dominio non riceve email |
| CAA | `@` | Tag **Only allow specific hostnames**, CA domain name `letsencrypt.org` | Solo autorità scelte possono emettere certificati |

Basta un solo record CAA: appena ne crei uno, Cloudflare aggiunge da sola, in modo invisibile, quelli delle altre autorità che usa per i tuoi certificati (Google Trust Services, SSL.com, Sectigo). Così il rinnovo automatico dei certificati continua a funzionare.

## Passo 13. Controlla che non restino record DNS inutili

In *DNS › Records* devono esserci **solo**:

- il record del sito creato da Cloudflare Pages per `fermitutti.it` (tipo CNAME o simile, verso `...pages.dev`);
- il record `A` di `www` del passo 9;
- i record TXT, MX e CAA del passo 12 (il CAA che hai creato tu; quelli aggiunti da Cloudflare non si vedono nell'elenco).

Se c'è altro, per esempio vecchi record di OVHcloud, cancellalo. Ogni record che punta a un servizio che non usi è una porta che qualcuno potrebbe aprire.

## Passo 14. Avvia l'aggiornamento automatico

1. Su GitHub apri la scheda **Actions** del repository. Se GitHub chiede di attivare i workflow, conferma.
2. A sinistra scegli **Aggiorna gli scioperi**, poi *Run workflow › Run workflow*.
3. Dopo un minuto o due l'esecuzione diventa verde. Se i dati sono cambiati, compare un nuovo commit «Dati aggiornati» e Cloudflare ripubblica il sito da solo.

Da questo momento l'aggiornamento parte da solo **ogni 30 minuti**. Il sito si ripubblica quando cambiano i dati, ogni notte dopo la mezzanotte e comunque almeno ogni 6 ore.

Una regola di GitHub disattiva i workflow programmati nei repository pubblici dopo 60 giorni senza attività. Qui non succede, perché il sito salva i dati almeno ogni 6 ore e ogni salvataggio conta come attività.

## Passo 15. Controllo finale

1. Su GitHub, *Actions › Controllo online › Run workflow*, scrivi `fermitutti.it` e premi il pulsante verde.
2. Apri l'esecuzione: ogni riga deve avere il segno ✔.

Se una riga ha ✘:

- **HTTPS o intestazioni**: il dominio non punta ancora al sito, oppure il passo 8 non è finito. Aspetta qualche minuto e riprova.
- **www**: rivedi il passo 9.
- **DNSSEC**: può volerci un giorno; se dopo 48 ore è ancora ✘, rivedi il passo 11.
- **SPF, DMARC, MX o CAA**: rivedi il passo 12.
- **TLS minimo 1.2**: rivedi il passo 10.
- **security.txt**: c'è ancora un segnaposto in `config/sito.mjs` (passo 5).
- **Cloudflare non modifica le pagine**: rivedi il punto 4 del passo 10.
- **Pagina inesistente sotto /widget/**: il sito non è aggiornato all'ultima versione; aspetta la ripubblicazione e riprova.

Chi ha Node.js sul computer può fare lo stesso controllo con `npm run verifica-online -- fermitutti.it`.

## Passo 16 (facoltativo, dopo un mese). HSTS preload

Quando tutto funziona da almeno un mese, puoi chiedere ai browser di usare **sempre** HTTPS per il tuo dominio, anche alla prima visita.

È difficile da annullare: fallo solo se il sito funziona bene in HTTPS e non pensi di cambiare dominio.

1. Su GitHub modifica `src/_headers`. Nella riga `Strict-Transport-Security` aggiungi `; preload` alla fine, così: `max-age=63072000; includeSubDomains; preload`.
2. Aspetta che Cloudflare ripubblichi il sito, poi su https://hstspreload.org scrivi `fermitutti.it` e premi *Check HSTS preload status and eligibility*. Invia la richiesta solo se il controllo non segnala errori.

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
- **Dominio.** Il rinnovo è automatico, ma controlla che la carta di pagamento su OVHcloud sia valida.

## Costi e limiti gratuiti

| Servizio | Costo | Limite gratuito | Uso previsto |
|---|---|---|---|
| Dominio `.it` (OVHcloud) | 3,65 euro il primo anno, poi 10,97 euro l'anno | | |
| GitHub (repository pubblico) | 0 | Minuti di Actions illimitati per i repository pubblici | Circa 50 esecuzioni al giorno, un minuto ciascuna |
| Cloudflare Pages | 0 | 500 build al mese, 20.000 file | Da 120 a 250 build al mese (dati cambiati più una ogni 6 ore); da 350 a circa 800 file |

## Provare il sito sul proprio computer (facoltativo)

Serve Node.js 22 o più recente.

```
npm ci --ignore-scripts
npm test
npm run build
npm run servi
```

Poi apri http://127.0.0.1:8080/ nel browser.
