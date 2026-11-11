// Prova di costruzione in memoria, senza scrivere file e senza dipendenze npm.
// Lo script di aggiornamento la esegue PRIMA di salvare i dati: un dato che farebbe fallire la build non entra mai nel repository.
import configSito from '../../config/sito.mjs';
import { validaArchivio } from './valida-archivio.mjs';
import { creaContesto, testiEvento, datiAnteprima } from './contesto.mjs';
import * as P from './pagine.mjs';
import { evento, calendario } from './ics.mjs';
import { svgAnteprima, xmlValido } from './og.mjs';
import { CITTA } from './luoghi.mjs';

const SENZA_AFFILIAZIONI = { airhelp: null, flixbus: null, noleggio: null, pubblicita: false };

export function provaCostruzione(archivio, { oggi, stato = {} }) {
  validaArchivio(archivio);
  const ctx = creaContesto({ archivio, stato, oggi, sito: configSito, aff: SENZA_AFFILIAZIONI, versione: 'prova' });
  for (const s of archivio.scioperi) {
    try {
      P.paginaSciopero(ctx, s);
      calendario({ nome: 'prova', descrizione: 'prova', prodid: '-//prova//IT', eventi: [evento(s, testiEvento(ctx, s))] });
      if (!xmlValido(svgAnteprima(datiAnteprima(ctx, s)))) throw new Error('immagine di anteprima con caratteri non ammessi');
    } catch (e) {
      throw new Error(`sciopero ${s.id}: ${e.message}`);
    }
  }
  P.paginaHome(ctx);
  for (const c of CITTA.slice(0, 3)) { P.paginaCitta(ctx, c); P.paginaWidget(ctx, c); }
  return true;
}
