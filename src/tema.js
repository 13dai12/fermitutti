// Prima che la pagina venga disegnata: segna che JavaScript è attivo e applica il tema salvato (niente lampeggi).
// Nessun dato esce dal browser.
(function () {
  var radice = document.documentElement;
  radice.className += ' js';
  try {
    var t = localStorage.getItem('tema');
    if (t === 'chiaro' || t === 'scuro') radice.setAttribute('data-tema', t);
  } catch (e) { /* memoria del browser non disponibile: va bene il tema di sistema */ }
})();
