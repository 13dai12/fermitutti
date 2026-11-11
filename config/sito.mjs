// Impostazioni del sito. Cambia qui nome, dominio e contatti: tutto il resto si adegua alla prossima build.
export default {
  // Nome e dominio: fermitutti.com, registrato su Cloudflare. Per cambiare dominio basta modificare dominio e urlBase.
  nome: 'Fermi Tutti',
  dominio: 'fermitutti.com',
  // Indirizzo completo del sito, senza barra finale. Usato per link assoluti, calendari, sitemap e anteprime.
  urlBase: 'https://fermitutti.com',
  slogan: 'Lo sciopero tocca me, e quando?',
  descrizione: 'Scioperi dei trasporti in Italia: oggi, domani e nei prossimi 7 giorni. Treni, aerei, bus e metro, città per città, dai dati ufficiali del Ministero. Senza login e senza app.',
  lingua: 'it',

  // Nome ed email del titolare. Consigliato: lasciare qui i segnaposto e impostare su Cloudflare Pages le variabili
  // TITOLARE_NOME e TITOLARE_EMAIL, così il nome non finisce nel repository pubblico (vedi DEPLOY.md, passo 5).
  // Se invece li scrivi qui, saranno visibili a tutti su GitHub e resteranno nella storia del repository.
  titolare: {
    nome: '[NOME E COGNOME DEL TITOLARE]',       // es. "Mario Rossi"
    email: '[EMAIL DI CONTATTO]',                // es. "contatti@fermitutti.com" con l'inoltro gratuito di Cloudflare (DEPLOY.md, passo 12)
    partitaIva: '',                               // lascia vuoto se non hai partita IVA
    indirizzo: '',                                // facoltativo
  },
  // Contatto per segnalazioni di sicurezza (/.well-known/security.txt). Può essere la stessa email.
  emailSicurezza: '[EMAIL DI CONTATTO]',

  // Repository GitHub (serve per i link "segnala un problema" e la pagina di stato).
  repository: 'https://github.com/13dai12/fermitutti',

  // Dopo quante ore senza pubblicazioni il sito mostra l'avviso "dati non aggiornati" (il sito si ripubblica almeno ogni 6 ore).
  oreAvvisoDatiVecchi: 8,

  // Statistiche senza cookie (Cloudflare Web Analytics). Spente (false). Per accenderle vedi DEPLOY.md:
  // si attivano nel pannello di Cloudflare e qui si mette true, così il sito permette lo script di Cloudflare
  // e la pagina della privacy lo dichiara.
  statisticheCloudflare: false,
};
