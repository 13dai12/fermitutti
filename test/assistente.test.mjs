// Oltre 150 domande di prova per l'assistente, ognuna con la risposta attesa.
// Dati: feed reale del 10/11/2026 + scioperi inventati 9001 (revocato), 9002 (rinviato) e 9003 (nuova data).
// "Oggi" è mercoledì 11 novembre 2026, salvo dove indicato.
// Campi attesi: intento, dal, al, luoghi, settori, ids (elenco esatto, in ordine), contiene (testo nella risposta), nonContiene.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaAssistente, normalizzaDomanda, distanza } from '../src/js/assistente.mjs';
import { compattiDiProva, baseDiProva } from './aiuto.mjs';

const assistente = creaAssistente({ scioperi: compattiDiProva(), base: baseDiProva() });
const OGGI = '2026-11-11';
const NAZ_20 = ['8635', '8610', '8633', '8592', '8638', '8640'];
const TRENI_20 = ['8635', '8610', '8592', '8638'];
const ROMA_BUS = ['8610', '8633', '8592', '9003', '8575', '9002'];

const CASI = [
  // --- esempi della specifica ---
  ["c'è sciopero domani a milano?", { intento: 'cerca', dal: '2026-11-12', al: '2026-11-12', luoghi: ['milano'], ids: [], contiene: ['non risultano', 'venerdì 13 novembre'] }],
  ['treni venerdì', { intento: 'cerca', dal: '2026-11-13', luoghi: [], settori: ['treni'], ids: [], contiene: ['venerdì 20 novembre'] }],
  ['sciopero aerei 14 novembre', { intento: 'cerca', dal: '2026-11-14', al: '2026-11-14', settori: ['aerei'], ids: [], contiene: ['venerdì 20 novembre'] }],
  ['fasce garantite roma', { intento: 'fasce', luoghi: ['roma'], contiene: ['Fasce garantite a Roma', 'ATAC'] }],
  ['mi rimborsano il volo?', { intento: 'rimborso_volo', contiene: ['261/2004'] }],
  ['come metto gli scioperi nel calendario?', { intento: 'calendario', settori: [] }],
  // --- date relative ---
  ["c'è sciopero oggi?", { intento: 'cerca', dal: OGGI, al: OGGI, ids: [] }],
  ['domani', { intento: 'cerca', dal: '2026-11-12', ids: [] }],
  ['dopodomani', { intento: 'cerca', dal: '2026-11-13', ids: ['8598', '8602'] }],
  ['dopo domani a venezia', { intento: 'cerca', dal: '2026-11-13', luoghi: ['venezia'], ids: ['8598'] }],
  ['scioperi venerdì', { intento: 'cerca', dal: '2026-11-13', ids: ['8598', '8602'] }],
  ['scioperi questo weekend', { intento: 'cerca', dal: '2026-11-14', al: '2026-11-15', ids: ['8605'] }],
  ['sciopero nel fine settimana', { intento: 'cerca', dal: '2026-11-14', al: '2026-11-15', ids: ['8605'] }],
  ['sabato e domenica ci sono scioperi?', { intento: 'cerca', dal: '2026-11-14', al: '2026-11-15', ids: ['8605'] }],
  ['questa settimana', { intento: 'cerca', dal: OGGI, al: '2026-11-15', ids: ['8598', '8602', '8605'] }],
  ['prossima settimana treni', { intento: 'cerca', dal: '2026-11-16', al: '2026-11-22', settori: ['treni'], ids: ['8635', '8610', '8592', '8638', '8625', '9001'] }],
  ['scioperi a breve', { intento: 'cerca', dal: OGGI, al: '2026-11-18', ids: ['8598', '8602', '8605', '8603', '8632', '8636', '9001'] }],
  ['nei prossimi giorni ci sono scioperi a napoli?', { intento: 'cerca', al: '2026-11-18', luoghi: ['napoli'], ids: ['8603', '8632', '8636'] }],
  ["c'è sciopero stasera?", { intento: 'cerca', dal: OGGI, ids: [] }],
  ['oggi o domani ci sono scioperi a bari?', { intento: 'cerca', dal: OGGI, al: '2026-11-12', luoghi: ['bari'], ids: [], contiene: ['sabato 14 novembre'] }],
  ['sciopero oggi e domani a napoli', { intento: 'cerca', dal: OGGI, al: '2026-11-12', luoghi: ['napoli'], ids: [] }],
  ['ieri', { intento: 'cerca', dal: '2026-11-10', ids: ['8619', '8637', '8630'] }],
  ['sciopero mercoledì', { intento: 'cerca', dal: OGGI, ids: [] }],
  ['sciopero mercoledì prossimo', { intento: 'cerca', dal: '2026-11-18', ids: ['9001'], contiene: ['revocato'] }],
  ['sciopero giovedì', { intento: 'cerca', dal: '2026-11-12', ids: [] }],
  ['sciopero lunedì', { intento: 'cerca', dal: '2026-11-16', ids: ['8603', '8632', '8636'] }],
  ['scioperi martedì', { intento: 'cerca', dal: '2026-11-17', ids: [] }],
  ['sciopero domenica', { intento: 'cerca', dal: '2026-11-15', ids: [] }],
  ['sciopero aerei domenica prossima', { intento: 'cerca', dal: '2026-11-15', settori: ['aerei'], ids: [] }],
  ['sciopero questo mese', { intento: 'cerca', dal: OGGI, al: '2026-11-30' }],
  ['scioperi il prossimo mese', { intento: 'cerca', dal: '2026-12-01', al: '2026-12-31' }],
  // --- date esplicite ---
  ['sciopero 14/11', { intento: 'cerca', dal: '2026-11-14', ids: ['8605'] }],
  ['sciopero il 16', { intento: 'cerca', dal: '2026-11-16', ids: ['8603', '8632', '8636'] }],
  ['sciopero lunedì 16', { intento: 'cerca', dal: '2026-11-16', ids: ['8603', '8632', '8636'] }],
  ['sciopero 20 novembre', { intento: 'cerca', dal: '2026-11-20', ids: NAZ_20 }],
  ['sciopero 20/11/2026', { intento: 'cerca', dal: '2026-11-20', ids: NAZ_20 }],
  ['sciopero 20-11', { intento: 'cerca', dal: '2026-11-20', ids: NAZ_20 }],
  ['sciopero 20.11', { intento: 'cerca', dal: '2026-11-20', ids: NAZ_20 }],
  ['sciopero 19 novembre', { intento: 'cerca', dal: '2026-11-19', ids: ['8610', '9002'] }],
  ["c'è sciopero giovedì 19?", { intento: 'cerca', dal: '2026-11-19', ids: ['8610', '9002'] }],
  ['sciopero 21 novembre', { intento: 'cerca', dal: '2026-11-21', ids: ['8635', '8592', '8638', '8625', '8639'] }],
  ['sciopero 1 dicembre', { intento: 'cerca', dal: '2026-12-01', ids: [], contiene: ['venerdì 4 dicembre'] }],
  ['sciopero primo dicembre', { intento: 'cerca', dal: '2026-12-01', ids: [] }],
  ['sciopero 1° dicembre', { intento: 'cerca', dal: '2026-12-01', ids: [] }],
  ['sciopero 3 dicembre', { intento: 'cerca', dal: '2026-12-03', ids: ['8575'] }],
  ['sciopero 4 dicembre', { intento: 'cerca', dal: '2026-12-04', ids: ['8575', '8626'] }],
  ['sciopero il 4', { intento: 'cerca', dal: '2026-12-04', ids: ['8575', '8626'] }],
  ['sciopero 4 dic', { intento: 'cerca', dal: '2026-12-04', ids: ['8575', '8626'] }],
  ['sciopero dal 13 al 16 novembre', { intento: 'cerca', dal: '2026-11-13', al: '2026-11-16', ids: ['8598', '8602', '8605', '8603', '8632', '8636'] }],
  ['dal 20 al 22 novembre aerei', { intento: 'cerca', dal: '2026-11-20', al: '2026-11-22', settori: ['aerei'], ids: ['8610', '8633', '8579', '8588'] }],
  ['sciopero aerei 15 gennaio', { intento: 'cerca', dal: '2027-01-15', settori: ['aerei'], ids: ['8613', '8614', '8623', '8627', '8631', '8641'] }],
  ['sciopero 15/01', { intento: 'cerca', dal: '2027-01-15', ids: ['8613', '8614', '8623', '8627', '8631', '8641'] }],
  ['sciopero aerei dicembre', { intento: 'cerca', dal: '2026-12-01', al: '2026-12-31', settori: ['aerei'], ids: ['8575', '8594', '8607', '8616'] }],
  ['sciopero sicilia 10 novembre', { intento: 'cerca', dal: '2026-11-10', luoghi: ['sicilia'], ids: ['8637', '8630'] }],
  ['sciopero novmbre 20', { intento: 'cerca', luoghi: [] }],
  // --- città e regioni ---
  ['sciopero bus napoli lunedi', { intento: 'cerca', dal: '2026-11-16', luoghi: ['napoli'], settori: ['bus-metro'], ids: ['8603', '8632', '8636'] }],
  ["c'è sciopero a milano venerdì?", { intento: 'cerca', dal: '2026-11-13', luoghi: ['milano'], ids: ['8602'] }],
  ['metro milano venerdì 13 novembre', { intento: 'cerca', dal: '2026-11-13', luoghi: ['milano'], settori: ['bus-metro'], ids: ['8602'] }],
  ['sciopero bari sabato', { intento: 'cerca', dal: '2026-11-14', luoghi: ['bari'], ids: ['8605'] }],
  ['bus bari 14 novembre', { intento: 'cerca', luoghi: ['bari'], settori: ['bus-metro'], ids: ['8605'] }],
  ['sciopero venezia 13 novembre', { intento: 'cerca', luoghi: ['venezia'], ids: ['8598'] }],
  ['sciopero verona 21 novembre', { intento: 'cerca', luoghi: ['verona'], ids: ['8635', '8592', '8638', '8625', '8639'] }],
  ['verona treni sabato 21', { intento: 'cerca', dal: '2026-11-21', luoghi: ['verona'], settori: ['treni'], ids: ['8635', '8592', '8638', '8625'] }],
  ['sciopero lecce 16 dicembre', { intento: 'cerca', luoghi: ['lecce'], ids: ['8634', '8616'] }],
  ['bus lecce dicembre', { intento: 'cerca', luoghi: ['lecce'], settori: ['bus-metro'], ids: ['8575', '8634'] }],
  ['sciopero bologna 15 dicembre', { intento: 'cerca', luoghi: ['bologna'], ids: ['8607', '8629'] }],
  ['aerei a bologna il 15 dicembre', { intento: 'cerca', luoghi: ['bologna'], settori: ['aerei'], ids: ['8607'] }],
  ['aerei a bologna il 16 dicembre', { intento: 'cerca', luoghi: ['bologna'], settori: ['aerei'], ids: ['8616'] }],
  ['sciopero roma 19 novembre', { intento: 'cerca', luoghi: ['roma'], ids: ['8610', '9002'], contiene: ['rinviat'] }],
  ['sciopero roma 26 novembre', { intento: 'cerca', luoghi: ['roma'], ids: ['9003'] }],
  ['sciopero milano 18 novembre', { intento: 'cerca', luoghi: ['milano'], ids: ['9001'], contiene: ['non risultano', 'revocat'] }],
  ['treni lombardia 18 novembre', { intento: 'cerca', luoghi: ['lombardia'], settori: ['treni'], ids: ['9001'] }],
  ['sciopero in puglia 14 novembre', { intento: 'cerca', luoghi: ['puglia'], ids: ['8605'] }],
  ['sciopero campania lunedì', { intento: 'cerca', luoghi: ['campania'], ids: ['8603', '8632', '8636'] }],
  ['sciopero sicilia domani', { intento: 'cerca', luoghi: ['sicilia'], ids: [] }],
  ['sciopero emilia romagna dicembre', { intento: 'cerca', luoghi: ['emilia-romagna'], ids: ['8575', '8594', '8607', '8629', '8616', '8626'] }],
  ['sciopero napoli', { intento: 'cerca', luoghi: ['napoli'] }],
  ['sciopero reggio emilia', { intento: 'cerca', luoghi: ['reggio-emilia'] }],
  ['sciopero reggio calabria', { intento: 'cerca', luoghi: ['reggio-calabria'] }],
  ['sciopero a reggio', { intento: 'chiarimento', contiene: ['Reggio Calabria o Reggio Emilia'] }],
  ['sciopero in lombardia', { intento: 'cerca', luoghi: ['lombardia'] }],
  ['sciopero friuli venezia giulia', { intento: 'cerca', luoghi: ['friuli-venezia-giulia'] }],
  ["sciopero valle d'aosta", { intento: 'cerca', luoghi: ['valle-d-aosta'] }],
  ['sciopero aosta', { intento: 'cerca', luoghi: ['aosta'] }],
  ["sciopero l'aquila", { intento: 'cerca', luoghi: ['l-aquila'] }],
  ['sciopero alto adige', { intento: 'cerca', luoghi: ['trentino-alto-adige'] }],
  ['sciopero bolzano', { intento: 'cerca', luoghi: ['bolzano'] }],
  ['sciopero bozen', { intento: 'cerca', luoghi: ['bolzano'] }],
  ['sciopero monza e brianza', { intento: 'cerca', luoghi: ['monza'] }],
  ['sciopero trento', { intento: 'cerca', luoghi: ['trento'] }],
  ['sciopero mestre', { intento: 'cerca', luoghi: ['venezia'] }],
  ['sciopero milano e roma venerdì 20', { intento: 'cerca', dal: '2026-11-20', luoghi: ['milano', 'roma'], ids: NAZ_20 }],
  ['sciopero treni milano roma 20 novembre', { intento: 'cerca', luoghi: ['milano', 'roma'], settori: ['treni'], ids: TRENI_20 }],
  ['sciopero sardegna', { intento: 'cerca', luoghi: ['sardegna'] }],
  ['sciopero a cagliari domani', { intento: 'cerca', luoghi: ['cagliari'], ids: [] }],
  // --- settori ---
  ['treni 20 novembre', { intento: 'cerca', settori: ['treni'], ids: TRENI_20 }],
  ['sciopero generale 20 novembre', { intento: 'cerca', settori: ['generale'], ids: ['8610', '8633', '8640'] }],
  ['sciopero generale dicembre', { intento: 'cerca', settori: ['generale'], ids: ['8575', '8626'] }],
  ['sciopero taxi', { intento: 'cerca', settori: ['taxi'], ids: ['8610', '8633', '8629'] }],
  ['taxi 15 dicembre', { intento: 'cerca', settori: ['taxi'], ids: ['8629'] }],
  ['taxi roma 15/12', { intento: 'cerca', luoghi: ['roma'], settori: ['taxi'], ids: ['8629'] }],
  ['sciopero dei taxi a milano a dicembre', { intento: 'cerca', luoghi: ['milano'], settori: ['taxi'], ids: ['8629'] }],
  ['traghetti dicembre', { intento: 'cerca', settori: ['traghetti'], ids: [] }],
  ['traghetto domani', { intento: 'cerca', settori: ['traghetti'], ids: [] }],
  ['sciopero navi', { intento: 'cerca', settori: ['traghetti'] }],
  ['voli 22 novembre', { intento: 'cerca', settori: ['aerei'], ids: ['8579', '8588'] }],
  ['aereo domenica', { intento: 'cerca', dal: '2026-11-15', settori: ['aerei'], ids: [] }],
  ['merci 21 novembre', { intento: 'cerca', settori: ['merci'], ids: ['8592', '8638', '8639'] }],
  ['sciopero camion', { intento: 'cerca', settori: ['merci'] }],
  ['sciopero autostrade', { intento: 'cerca', settori: ['autostrade'], ids: ['8610', '8633', '8575'] }],
  ['casello autostrada 4 dicembre', { intento: 'cerca', settori: ['autostrade'], ids: ['8575'] }],
  ['sciopero ncc', { intento: 'cerca', settori: ['ncc'], ids: ['8610', '8633'] }],
  ['domani c\'è sciopero dei mezzi a roma?', { intento: 'cerca', luoghi: ['roma'], settori: ['bus-metro'], ids: [] }],
  ['sciopero tram torino giovedì', { intento: 'cerca', dal: '2026-11-12', luoghi: ['torino'], settori: ['bus-metro'], ids: [] }],
  ['autobus genova', { intento: 'cerca', luoghi: ['genova'], settori: ['bus-metro'] }],
  ['sciopero frecciarossa', { intento: 'cerca', settori: ['treni'] }],
  ['sciopero treni regionali domani', { intento: 'cerca', settori: ['treni'], ids: [] }],
  // --- aziende ---
  ['sciopero atac', { intento: 'cerca', luoghi: ['roma'], settori: ['bus-metro'], ids: ROMA_BUS }],
  ['sciopero cotral', { intento: 'cerca', luoghi: ['lazio'], settori: ['bus-metro'], ids: ROMA_BUS }],
  ['sciopero trenord', { intento: 'cerca', luoghi: ['lombardia'], settori: ['treni'], ids: ['8635', '8610', '8592', '8638', '8575', '9001'] }],
  ['sciopero italo 20 novembre', { intento: 'cerca', settori: ['treni'], ids: TRENI_20 }],
  ['sciopero trenitalia domani', { intento: 'cerca', settori: ['treni'], ids: [] }],
  ['sciopero ryanair', { intento: 'cerca', settori: ['aerei'] }],
  ['anm', { intento: 'cerca', luoghi: ['napoli'], settori: ['bus-metro'], ids: ['8603', '8632', '8636', '8610', '8633', '8592', '8575'] }],
  ['sciopero malpensa', { intento: 'cerca', luoghi: ['milano'], settori: ['aerei'], ids: ['8610', '8633', '8579', '8588', '8575', '8594', '8616'] }],
  ['fiumicino 14 dicembre', { intento: 'cerca', luoghi: ['roma'], settori: ['aerei'], ids: ['8594'] }],
  ['sciopero linate gennaio', { intento: 'cerca', dal: '2027-01-01', al: '2027-01-31', luoghi: ['milano'], settori: ['aerei'], ids: ['8613', '8614', '8623', '8627', '8631', '8641'] }],
  ['circumvesuviana domani', { intento: 'cerca', luoghi: ['campania'], settori: ['bus-metro'], ids: [] }],
  ['gtt', { intento: 'cerca', luoghi: ['torino'], settori: ['bus-metro'] }],
  // --- errori di battitura e forme diverse ---
  ["c'e sciopero domani a Milano", { intento: 'cerca', dal: '2026-11-12', luoghi: ['milano'], ids: [] }],
  ["C'È SCIOPERO DOMANI A MILANO?", { intento: 'cerca', dal: '2026-11-12', luoghi: ['milano'], ids: [] }],
  ['sciopero domani milano!!!', { intento: 'cerca', dal: '2026-11-12', luoghi: ['milano'] }],
  ['sciopero domani a milan', { intento: 'cerca', luoghi: ['milano'] }],
  ['sciopero domni a milano', { intento: 'cerca', dal: '2026-11-12', luoghi: ['milano'] }],
  ['sciopero a napli venerdi', { intento: 'cerca', dal: '2026-11-13', luoghi: ['napoli'], ids: [] }],
  ['sciopero torinno domani', { intento: 'cerca', luoghi: ['torino'] }],
  ['sciopero firenzw', { intento: 'cerca', luoghi: ['firenze'] }],
  ['sciopero bologan', { intento: 'cerca', luoghi: ['bologna'] }],
  ['sciopero palerrmo', { intento: 'cerca', luoghi: ['palermo'] }],
  ['sciopero genva', { intento: 'cerca', luoghi: ['genova'] }],
  ['treni venrdì', { intento: 'cerca', dal: '2026-11-13', settori: ['treni'] }],
  ['aerei sabto', { intento: 'cerca', dal: '2026-11-14', settori: ['aerei'] }],
  ['bus luendì', { intento: 'cerca', dal: '2026-11-16', settori: ['bus-metro'] }],
  ['metropolitanna roma', { intento: 'cerca', luoghi: ['roma'], settori: ['bus-metro'] }],
  ['aereii domani', { intento: 'cerca', dal: '2026-11-12', settori: ['aerei'] }],
  ['trenni milano domani', { intento: 'cerca', luoghi: ['milano'], settori: ['treni'], ids: [] }],
  ['autobuss napoli', { intento: 'cerca', luoghi: ['napoli'], settori: ['bus-metro'] }],
  // --- parole che NON sono città ---
  ['parto domani da torino', { intento: 'cerca', luoghi: ['torino'], ids: [] }],
  ['torno a casa domani in treno', { intento: 'cerca', luoghi: [], settori: ['treni'], ids: [] }],
  ['è ancora valido lo sciopero di venerdì?', { intento: 'cerca', dal: '2026-11-13', luoghi: [], ids: ['8598', '8602'] }],
  ['come metto i treni nel calendario', { intento: 'calendario', luoghi: [] }],
  ['costa qualcosa?', { intento: 'non_capito', luoghi: [] }],
  ['posta oggi', { luoghi: [] }],
  ['trenta minuti di ritardo', { luoghi: [] }],
  // --- revoche e conferme ---
  ['è confermato lo sciopero dei treni del 18 novembre in lombardia?', { intento: 'cerca', ids: ['9001'], contiene: ['revocat'] }],
  ['è ancora confermato lo sciopero del 20?', { intento: 'cerca', dal: '2026-11-20', ids: NAZ_20, contiene: ['Confermato'] }],
  ['lo sciopero di roma del 19 è stato rinviato?', { intento: 'cerca', luoghi: ['roma'], ids: ['8610', '9002'] }],
  // --- fasce garantite ---
  ['fasce garantite milano', { intento: 'fasce', luoghi: ['milano'], contiene: ['ATM', 'Trenord'] }],
  ['fasce garantite treni', { intento: 'fasce', settori: ['treni'], contiene: ['Trenitalia'] }],
  ['fasce garantite aerei', { intento: 'fasce', settori: ['aerei'], contiene: ['7:00-10:00'] }],
  ['fasce orarie bus torino', { intento: 'fasce', luoghi: ['torino'], contiene: ['GTT'], nonContiene: ['Trenitalia'] }],
  ['orari garantiti napoli', { intento: 'fasce', luoghi: ['napoli'], contiene: ['EAV'] }],
  ['quali sono le fasce di garanzia a bologna', { intento: 'fasce', luoghi: ['bologna'], contiene: ['TPER', 'Trenitalia Tper'] }],
  ['fasce garantite', { intento: 'fasce', contiene: ['dipendono dal settore'] }],
  ['servizi minimi treni lombardia', { intento: 'fasce', luoghi: ['lombardia'], contiene: ['Trenord'] }],
  ['treni garantiti domani', { intento: 'fasce' }],
  ['fasce garantite a bergamo', { intento: 'fasce', luoghi: ['bergamo'], contiene: ['ATB'] }],
  ['fasce garantite a vicenza', { intento: 'fasce', luoghi: ['vicenza'], contiene: ['non abbiamo trovato una fonte ufficiale'] }],
  // --- rimborsi ---
  ['mi rimborsano il treno?', { intento: 'rimborso_treno' }],
  ['rimborso', { intento: 'rimborso' }],
  ['volo cancellato per sciopero, cosa mi spetta?', { intento: 'rimborso_volo' }],
  ['ho diritto al risarcimento se il volo ryanair salta?', { intento: 'rimborso_volo' }],
  ['come faccio ad avere il rimborso del biglietto del bus?', { intento: 'rimborso_treno' }],
  ['compensazione volo ritardo', { intento: 'rimborso_volo', nonContiene: ['ti spettano sicuramente'] }],
  // --- calendario, fonte, altro ---
  ['calendario milano', { intento: 'calendario', luoghi: ['milano'] }],
  ['voglio le notifiche degli scioperi', { intento: 'calendario', contiene: ['Non mandiamo notifiche'] }],
  ['come aggiungo gli scioperi a google calendar', { intento: 'calendario' }],
  ['iscrivermi al calendario dei treni', { intento: 'calendario' }],
  ['da dove prendete i dati?', { intento: 'fonte' }],
  ['siete un sito ufficiale?', { intento: 'fonte' }],
  ['sciopero scuola domani', { intento: 'scuola' }],
  ['sciopero sanità', { intento: 'scuola' }],
  ['sciopero insegnanti', { intento: 'scuola' }],
  ['grazie', { intento: 'grazie' }],
  ['buongiorno', { intento: 'saluto' }],
  ['ciao', { intento: 'saluto' }],
  ['aiuto', { intento: 'aiuto' }],
  ['cosa sai fare?', { intento: 'aiuto' }],
  ['come funziona?', { intento: 'aiuto' }],
  ["ciao, c'è sciopero sabato a bari?", { intento: 'cerca', dal: '2026-11-14', luoghi: ['bari'], ids: ['8605'] }],
  ['', { intento: 'vuoto' }],
  ['   ', { intento: 'vuoto' }],
  ['asdfgh', { intento: 'non_capito' }],
  ['qwerty uiop', { intento: 'non_capito' }],
  // --- testo malevolo: mai riportato nella risposta ---
  ['<script>alert(1)</script>', { intento: 'non_capito', nonContiene: ['<script', 'alert('] }],
  ['sciopero <img src=x onerror=alert(1)> milano', { intento: 'cerca', luoghi: ['milano'], nonContiene: ['onerror', '<img'] }],
  ['javascript:alert(1) domani', { intento: 'cerca', dal: '2026-11-12', nonContiene: ['javascript:'] }],
  [`sciopero ${'a'.repeat(5000)} roma`, { luoghi: [] }],
  // --- "oggi" diverso ---
  ['weekend prossimo', { oggi: '2026-11-14', intento: 'cerca', dal: '2026-11-21', al: '2026-11-22', ids: ['8635', '8592', '8638', '8625', '8579', '8588', '8639'] }],
  ['questo weekend', { oggi: '2026-11-15', intento: 'cerca', dal: '2026-11-15', al: '2026-11-15', ids: [] }],
  ['questo weekend', { oggi: '2026-11-14', intento: 'cerca', dal: '2026-11-14', al: '2026-11-15', ids: ['8605'] }],
  ['sciopero domani', { oggi: '2026-11-19', intento: 'cerca', dal: '2026-11-20', ids: NAZ_20 }],
  ['treni stasera', { oggi: '2026-11-19', intento: 'cerca', dal: '2026-11-19', settori: ['treni'], ids: ['8610'] }],
  ['sciopero oggi', { oggi: '2026-11-13', intento: 'cerca', ids: ['8598', '8602'] }],
  ['sciopero oggi a monza', { oggi: '2026-11-13', intento: 'cerca', luoghi: ['monza'], ids: ['8602'] }],
  ['atm milano', { oggi: '2026-11-13', intento: 'cerca', luoghi: ['milano'], settori: ['bus-metro'], ids: ['8602', '8610', '8633', '8592', '8575'] }],
  ['sciopero 31 dicembre', { oggi: '2026-12-20', intento: 'cerca', dal: '2026-12-31', ids: [] }],
  ['sciopero 2 gennaio', { oggi: '2026-12-20', intento: 'cerca', dal: '2027-01-02' }],
  ['prossima settimana', { oggi: '2026-12-29', intento: 'cerca', dal: '2027-01-04', al: '2027-01-10' }],
];

test(`le domande di prova sono almeno 150 (sono ${CASI.length})`, () => {
  assert.ok(CASI.length >= 150);
});

for (const [domanda, atteso] of CASI) {
  test(`assistente: «${domanda.length > 60 ? domanda.slice(0, 60) + '…' : domanda}»${atteso.oggi ? ` (oggi ${atteso.oggi})` : ''}`, () => {
    const r = assistente.rispondi(domanda, { oggi: atteso.oggi || OGGI });
    const tutto = [r.testo, ...(r.aggiunte || []), ...(r.elenco || []).map((x) => `${x.titolo} ${x.dettaglio}`)].join(' ');
    if (atteso.intento) assert.equal(r.intento, atteso.intento, `intento: ${r.intento} (${tutto})`);
    if (atteso.dal) assert.equal(r.capito.dal, atteso.dal, 'data iniziale');
    if (atteso.al) assert.equal(r.capito.al, atteso.al, 'data finale');
    if (atteso.luoghi) assert.deepEqual(r.capito.luoghi || [], atteso.luoghi, 'luoghi');
    if (atteso.settori) assert.deepEqual(r.capito.settori || [], atteso.settori, 'settori');
    if (atteso.ids) assert.deepEqual(r.ids, atteso.ids, `scioperi trovati: ${r.ids}`);
    for (const c of atteso.contiene || []) assert.ok(tutto.includes(c), `la risposta dovrebbe contenere «${c}»: ${tutto}`);
    for (const c of atteso.nonContiene || []) assert.ok(!JSON.stringify(r).includes(c), `la risposta non deve contenere «${c}»`);
    // Regole sempre valide: testo non vuoto, link solo interni o https, nessun HTML.
    assert.ok(typeof r.testo === 'string' && r.testo.length > 0);
    for (const l of [...(r.link || []), ...(r.elenco || [])]) {
      if (l.url) assert.match(l.url, /^(\/[a-z0-9/#._-]*|https:\/\/[a-z0-9.-]+\/\S*)$/i);
    }
    assert.ok(!/[<>]/.test(tutto), 'nessun carattere < o > nelle risposte');
  });
}

test('normalizzazione e distanza', () => {
  assert.deepEqual(normalizzaDomanda("C'è  SCIOPERO, domani?"), ['c', 'e', 'sciopero', 'domani']);
  assert.deepEqual(normalizzaDomanda('sciopero 20/11 e 1.12'), ['sciopero', '20/11', 'e', '1.12']);
  assert.equal(distanza('bologan', 'bologna'), 1);
  assert.equal(distanza('napli', 'napoli'), 1);
  assert.equal(distanza('roma', 'milano'), 5);
});
