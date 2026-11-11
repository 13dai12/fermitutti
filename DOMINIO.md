# Nome e dominio

## Scelta fatta: **Fermi Tutti**, `fermitutti.com`

Il dominio `fermitutti.com` è stato registrato su Cloudflare l'11 novembre 2026. Il sito lo usa già: è scritto in `config/sito.mjs`, insieme a `urlBase`. Per cambiare dominio in futuro basta modificare quelle due righe.

Perché `.com` e non `.it`:

- **Cloudflare non vende i `.it`.** Nella sua pagina delle estensioni supportate il `.it` non c'è.
- **Tutto nello stesso posto.** Dominio, DNS e sito stanno nello stesso account Cloudflare. Non serve spostare i nameserver, e il DNSSEC si attiva con un clic: Cloudflare comunica da solo il record DS al registro del `.com`.
- **Prezzo di costo.** Cloudflare fa pagare il prezzo del registro, senza ricarichi.
- **Dati del titolare nascosti.** Nel whois pubblico Cloudflare mostra solo dati oscurati.
- **Su Google funziona anche in Italia.** Google guarda soprattutto la lingua e i contenuti delle pagine, che sono in italiano e parlano di città italiane. Un `.it` darebbe solo un piccolo segnale in più.

Stato verificato l'11 novembre 2026: il dominio usa i nameserver di Cloudflare (`edward.ns.cloudflare.com` e `samara.ns.cloudflare.com`), la zona DNS è vuota e il DNSSEC non è ancora attivo. I passi per completare la configurazione sono in `DEPLOY.md`.

**`fermitutti.it` è ancora libero** (whois del Registro .it, 11 novembre 2026). Comprarlo non è necessario. Serve solo se vuoi impedire che altri lo usino: vedi l'ultima sezione.

## Perché «Fermi Tutti»

- **Si dice e si ricorda facilmente.** «Fermi tutti!» è un'espressione che tutti conoscono e che fa pensare subito a qualcosa che si ferma. Dettandolo a voce non ci sono dubbi di scrittura: niente accenti, niente trattini.
- **È breve e si condivide bene** su WhatsApp e nei passaparola.
- **Fa da marchio.** Un nome come «domanisciopero» descrive, ma è più facile da confondere con siti simili e da copiare. «Fermi Tutti» si riconosce.
- **Il canale Telegram `@fermitutti` risultava libero** l'11 novembre 2026: la pagina `t.me/fermitutti` non mostrava né un canale né un utente.

Il punto debole: il nome non contiene la parola «sciopero», che è quella che la gente cerca su Google. Il problema è piccolo, perché i titoli delle pagine la contengono sempre («Scioperi a Milano oggi e domani…»), ed è lì che Google guarda.

### Possibili conflitti con altri nomi

Ho cercato sul web «Fermi tutti» e «fermitutti». **Nessuna azienda, app o sito di trasporti o di scioperi usa questo nome.** L'espressione compare invece come titolo di:

- un podcast di RaiPlay Sound sulla storia della fisica italiana («Fermi tutti. La fisica italiana sale in cattedra»);
- due libri («Fermi tutti! Il club delle pigiamiste», Giunti; «Fermi tutti... sto sclerando», Youcanprint);
- il blog di un istituto comprensivo intitolato a Enrico Fermi.

Sono ambiti molto lontani dal tuo, quindi il rischio di conflitto è basso, ma non nullo: un titolo può essere stato registrato anche come marchio.

**Cosa non ho potuto fare io:** le banche dati dei marchi (EUIPO e UIBM) non si possono interrogare in automatico: il servizio TMview ha rifiutato la mia richiesta automatica. Prima di far conoscere il sito fai tu questo controllo, ti servono cinque minuti:

1. Apri [TMview](https://www.tmdn.org/tmview/) (marchi europei e italiani insieme), scrivi `fermi tutti` e cerca.
2. Apri la [banca dati dell'UIBM](https://www.uibm.gov.it/bancadati/), sezione Marchi, e cerca `fermi tutti`.
3. Se trovi un marchio **in vigore** nelle classi 9 (app e software), 35 (pubblicità), 38 (servizi online), 39 (informazioni sui trasporti), 41 (informazione ed editoria) o 42 (servizi web), parlane con un esperto prima di far conoscere il sito. Se trovi solo marchi in altre classi, o scaduti, puoi andare avanti.
4. Fai uno screenshot dei risultati e conservalo.

**Risultato del controllo su TMview, 11 novembre 2026.** È emerso un marchio «fermi tutti» depositato in Turchia nel 2005 per abbigliamento e pubblicità (classi 25 e 35), con stato «Terminato». Non è un conflitto: non è più valido e valeva solo in Turchia.

## Gli altri nomi considerati

Tutti verificati liberi l'11 novembre 2026, nella versione `.it`.

| Nome | Dominio | Pro | Contro |
|---|---|---|---|
| **Fermi Tutti** (scelto) | `fermitutti.com` | Breve, memorabile, facile da dettare, funziona da marchio. | Non contiene «sciopero». Stessa espressione usata come titolo di un podcast e di alcuni libri. |
| Domani Sciopero | `domanisciopero.it` | Corrisponde alla ricerca più frequente («domani c'è sciopero?»). Si capisce subito. | Più lungo; sembra parlare solo di domani; letto tutto attaccato è meno leggibile. |
| Radar Scioperi | `radarscioperi.it` | «Radar» suggerisce avvisi e controllo continuo. | Più lungo; dettandolo si può sbagliare tra «sciopero» e «scioperi». |
| Ci Sciopero | `cisciopero.it` | Molto breve. | Ambiguo a voce: si confonde con «c'è sciopero», e l'accento non si può scrivere nel dominio. |
| Meteo Disagi | `meteodisagi.it` | Simpatico, potrebbe coprire anche altri disagi. | Vago: non dice «sciopero» e può far pensare al meteo. |

Altri controllati: `scioperodomani.it` e `oggisciopero.it` erano liberi; `scioperometro.it`, `mispetta.it` e `scioperooggi.it` erano già registrati.

## Se un giorno vuoi anche `fermitutti.it`

Non serve al sito. Serve solo a impedire che qualcun altro usi lo stesso nome con il `.it`.

- Cloudflare non lo vende: va comprato da un registrar che vende i `.it`. **OVHcloud** è nell'[elenco ufficiale](https://www.nic.it/it/registrar/list?field_reg_dnssec_value=1) dei registrar che gestiscono il DNSSEC per i `.it`. L'11 novembre 2026 costava 3,65 euro il primo anno, poi 10,97 euro l'anno, IVA inclusa.
- Il `.it` si può registrare solo se risiedi nell'Unione europea (o in alcuni Paesi vicini). Ti chiederanno il codice fiscale.
- Per farlo puntare al sito: aggiungi `fermitutti.it` come nuovo dominio su Cloudflare (piano Free), metti i nameserver di Cloudflare nel pannello del registrar e crea un reindirizzamento 301 verso `https://fermitutti.com`, come per `www` al passo 9 di `DEPLOY.md`.
