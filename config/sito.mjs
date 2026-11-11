// Impostazioni del sito. Cambia qui nome, dominio e contatti: tutto il resto si adegua alla prossima build.
export default {
  // Nome e dominio. Se compri un dominio diverso da fermitutti.it, cambia SOLO queste due righe.
  nome: 'Fermi Tutti',
  dominio: 'fermitutti.it',
  // Indirizzo completo del sito, senza barra finale. Usato per link assoluti, calendari, sitemap e anteprime.
  urlBase: 'https://fermitutti.it',
  slogan: 'Lo sciopero tocca me, e quando?',
  descrizione: 'Scioperi dei trasporti in Italia: oggi, domani e nei prossimi 7 giorni. Treni, aerei, bus e metro, città per città, dai dati ufficiali del Ministero. Senza login e senza app.',
  lingua: 'it',

  // SEGNAPOSTO DA COMPILARE PRIMA DI PUBBLICARE (vedi DEPLOY.md e il rapporto finale).
  titolare: {
    nome: '[NOME E COGNOME DEL TITOLARE]',       // es. "Mario Rossi"
    email: '[EMAIL DI CONTATTO]',                // es. "ciao@fermitutti.it" oppure un indirizzo personale
    partitaIva: '',                               // lascia vuoto se non hai partita IVA
    indirizzo: '',                                // facoltativo
  },
  // Contatto per segnalazioni di sicurezza (/.well-known/security.txt). Può essere la stessa email.
  emailSicurezza: '[EMAIL DI CONTATTO]',

  // Repository GitHub (serve per i link "segnala un problema" e la pagina di stato).
  repository: 'https://github.com/[UTENTE-GITHUB]/fermitutti',

  // Dopo quante ore senza pubblicazioni il sito mostra l'avviso "dati non aggiornati" (il sito si ripubblica almeno ogni 6 ore).
  oreAvvisoDatiVecchi: 8,

  // Statistiche senza cookie (Cloudflare Web Analytics). Spente (false). Per accenderle vedi DEPLOY.md:
  // si attivano nel pannello di Cloudflare e qui si mette true, così il sito permette lo script di Cloudflare
  // e la pagina della privacy lo dichiara.
  statisticheCloudflare: false,
};
