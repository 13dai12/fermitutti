// Codici di affiliazione. TUTTI SPENTI finché non inserisci i tuoi codici.
// Regola: se un codice manca, il riquadro corrispondente NON compare sul sito.
// I link sono costruiti solo verso i domini elencati qui sotto: nessun redirect aperto, nessun link esterno "a sorpresa".
export default {
  // 1) RIMBORSI DEI VOLI (AirHelp). Programma ufficiale: https://www.airhelp.com/en-int/affiliate/
  //    Dopo l'approvazione AirHelp ti dà un link di tracciamento completo: incollalo qui tra virgolette.
  //    Deve iniziare con https:// e puntare a un dominio airhelp.com.
  airhelp: {
    link: '',   // es. 'https://www.airhelp.com/it/?a_aid=XXXXXX'  (il formato esatto te lo dà AirHelp)
  },

  // 2) ALTERNATIVE DI VIAGGIO: FlixBus tramite Awin (programma "Flixbus IT", id inserzionista 110876).
  //    Ti serve il tuo id editore Awin (un numero). Il link viene generato così:
  //    https://www.awin1.com/cread.php?awinmid=110876&awinaffid=TUO_ID&ued=https://www.flixbus.it/
  flixbus: {
    awinAffid: '',   // es. '123456'
    awinMid: '110876',
  },

  // 3) NOLEGGIO AUTO (facoltativo). Incolla un link affiliato completo di uno dei fornitori ammessi
  //    (domini ammessi: awin1.com, discovercars.com, rentalcars.com). Vuoto = riquadro assente.
  noleggioAuto: {
    link: '',
    nome: '',   // es. 'Discover Cars'
  },

  // 4) PUBBLICITÀ: solo uno spazio predisposto e spento. Per attivarla serve una piattaforma di consenso
  //    certificata da Google (vedi DEPLOY.md). Non cambiare questo valore senza aver letto quella sezione.
  pubblicita: {
    attiva: false,
  },
};
