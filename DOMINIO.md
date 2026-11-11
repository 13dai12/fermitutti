# Nome e dominio

Controlli fatti l'11 novembre 2026 alle 16:52 (ora UTC) con il whois ufficiale del Registro .it (`whois.nic.it`). Il servizio RDAP del Registro non era raggiungibile dalla mia rete, quindi ho usato il whois, che dà la stessa informazione.

## La mia raccomandazione: **Fermi Tutti**, `fermitutti.it`

- **È libero.** Il whois risponde `Status: AVAILABLE`. Sono liberi anche `fermitutti.com` e `fermitutti.eu`, se un giorno vorrai proteggere il nome.
- **Si dice e si ricorda facilmente.** «Fermi tutti!» è un'espressione che tutti conoscono e che fa pensare subito a qualcosa che si ferma. Dettandolo a voce non ci sono dubbi di scrittura: niente accenti, niente trattini.
- **È breve e si condivide bene** su WhatsApp e nei passaparola: dieci lettere più `.it`.
- **Fa da marchio.** Un nome come «domanisciopero» descrive, ma è più facile da confondere con siti simili e da copiare. «Fermi Tutti» si riconosce.
- **Il canale Telegram `@fermitutti` risulta libero**: la pagina `t.me/fermitutti` non mostra né un canale né un utente (ho confrontato con un canale esistente per essere sicuro del metodo).

Il punto debole: il nome non contiene la parola «sciopero», che è quella che la gente cerca su Google. Il problema è piccolo, perché i titoli delle pagine la contengono sempre («Scioperi a Milano oggi e domani…»), ed è lì che Google guarda.

### Possibili conflitti con altri nomi

Ho cercato sul web «Fermi tutti» e «fermitutti». **Nessuna azienda, app o sito di trasporti o di scioperi usa questo nome.** L'espressione compare invece come titolo di:

- un podcast di RaiPlay Sound sulla storia della fisica italiana («Fermi tutti. La fisica italiana sale in cattedra»);
- due libri («Fermi tutti! Il club delle pigiamiste», Giunti; «Fermi tutti... sto sclerando», Youcanprint);
- il blog di un istituto comprensivo intitolato a Enrico Fermi.

Sono ambiti molto lontani dal tuo, quindi il rischio di conflitto è basso, ma non nullo: un titolo può essere stato registrato anche come marchio.

**Cosa non ho potuto fare io:** le banche dati dei marchi (EUIPO e UIBM) non si possono interrogare in automatico: il servizio TMview ha rifiutato la mia richiesta automatica. Prima di comprare il dominio fai tu questo controllo, ti servono cinque minuti:

1. Apri [TMview](https://www.tmdn.org/tmview/) (marchi europei e italiani insieme), scrivi `fermi tutti` e cerca.
2. Apri la [banca dati dell'UIBM](https://www.uibm.gov.it/bancadati/), sezione Marchi, e cerca `fermi tutti`.
3. Se trovi un marchio **in vigore** nelle classi 9 (app e software), 35 (pubblicità), 38 (servizi online), 39 (informazioni sui trasporti), 41 (informazione ed editoria) o 42 (servizi web), scegli un altro nome dalla tabella qui sotto. Se trovi solo marchi in altre classi, o scaduti, puoi andare avanti.

## I cinque nomi migliori

Tutti verificati liberi l'11 novembre 2026.

| Nome | Dominio | Pro | Contro |
|---|---|---|---|
| **Fermi Tutti** (consigliato) | `fermitutti.it` | Breve, memorabile, facile da dettare, funziona da marchio. Liberi anche `.com`, `.eu` e `@fermitutti` su Telegram. | Non contiene «sciopero». Stessa espressione usata come titolo di un podcast e di alcuni libri. |
| Domani Sciopero | `domanisciopero.it` | Corrisponde alla ricerca più frequente («domani c'è sciopero?»). Si capisce subito. | Più lungo; sembra parlare solo di domani; letto tutto attaccato è meno leggibile. |
| Radar Scioperi | `radarscioperi.it` | «Radar» suggerisce avvisi e controllo continuo. | Più lungo; dettandolo si può sbagliare tra «sciopero» e «scioperi». |
| Ci Sciopero | `cisciopero.it` | Molto breve. | Ambiguo a voce: si confonde con «c'è sciopero», e l'accento non si può scrivere nel dominio. |
| Meteo Disagi | `meteodisagi.it` | Simpatico, potrebbe coprire anche altri disagi. | Vago: non dice «sciopero» e può far pensare al meteo. |

Altri controllati: `scioperodomani.it` e `oggisciopero.it` sono liberi; `scioperometro.it`, `mispetta.it` e `scioperooggi.it` sono già registrati. Anche `@domanisciopero`, `@cisciopero`, `@radarscioperi`, `@meteodisagi` e `@scioperidomani` risultano liberi su Telegram.

Se cambi nome, basta cambiare `nome`, `dominio` e `urlBase` in `config/sito.mjs`: il resto del sito si adegua da solo.

## Dove comprare il dominio

Ti serve un registrar che:

1. venda i domini `.it`;
2. permetta di usare i nameserver di Cloudflare;
3. permetta di attivare **DNSSEC** anche con nameserver esterni, cioè ti lasci inserire il «record DS» che ti darà Cloudflare;
4. abbia la protezione contro il trasferimento e la verifica in due passaggi.

Quello che ho verificato:

- **Cloudflare non vende i `.it`.** Nella sua pagina delle estensioni supportate il `.it` non c'è.
- **Il Registro .it permette DNSSEC solo tramite registrar accreditati.** Nel loro [elenco ufficiale](https://www.nic.it/it/registrar/list?field_reg_dnssec_value=1) ce ne sono 92. Ci sono OVHcloud, InterNetworX (INWX), Aruba, Register.it e Netsons. Non ci sono GoDaddy e Gandi.

**Consiglio: [OVHcloud](https://www.ovhcloud.com/it/domains/tld/it/).**

- Sito e guide in italiano.
- Prezzo del `.it`: 3,65 euro il primo anno, poi 10,97 euro l'anno (IVA inclusa, prezzi letti l'11 novembre 2026).
- È nell'elenco dei registrar accreditati DNSSEC del Registro .it.
- La sua [guida DNSSEC](https://docs.ovhcloud.com/it/guides/web-cloud/domains/dns-dnssec) spiega come inserire il record DS quando il dominio usa DNS esterni, come Cloudflare: c'è una scheda «record DS» apposta.
- Ha la «Protezione contro il trasferimento», attiva di default.
- Ha la [verifica in due passaggi](https://docs.ovhcloud.com/it/guides/account-and-service-management/account-information/secure-ovhcloud-account-with-2fa) con app, chiave di sicurezza e codici di riserva.

**Alternativa: [INWX](https://www.inwx.de/en/it-domain)**, registrar europeo, 10 euro l'anno. Supporta DNSSEC con record DS («Yes (DS)» nella sua scheda del `.it`). L'interfaccia è in inglese o tedesco.

Due avvertenze:

- In un forum di OVH una persona scriveva che OVH non supportava DNSSEC sui `.it`. Oggi OVH risulta nell'elenco ufficiale degli accreditati, quindi la discussione sembra superata. Se però, dopo aver spostato i nameserver su Cloudflare, nel pannello di OVH non compare la scheda «record DS», chiedi all'assistenza di OVH oppure trasferisci il dominio a INWX.
- Il `.it` si può registrare solo se risiedi nell'Unione europea (o in alcuni Paesi vicini). Se sei una persona fisica italiana ti chiederanno il codice fiscale.

Io non ho comprato nulla: i passi per l'acquisto sono in `DEPLOY.md`.
