// Toglie i commenti dai file serviti al browser: meno byte e niente note interne in chiaro per chi visita il sito.
// È volutamente prudente. Per JavaScript toglie solo righe intere di commento e righe vuote, mai pezzi di riga, e se
// trova qualcosa di ambiguo lascia il file com'è: un file con i commenti funziona sempre, uno rovinato no.

/** Vero se qualche riga ha un numero dispari di apici inversi, cioè un testo tra apici inversi che continua su più righe. */
function haTestiSuPiuRighe(righe) {
  // Le classi di caratteri all'inizio di un'espressione regolare, per esempio /[’'`´]/, possono contenere un apice inverso isolato.
  return righe.some((r) => (r.replace(/\/\[[^\]\n]*\]/g, '').split('`').length - 1) % 2 === 1);
}

export function jsSenzaCommenti(testo) {
  const righe = testo.split('\n');
  if (haTestiSuPiuRighe(righe)) return testo;
  const uscita = [];
  let inBlocco = false;
  for (const riga of righe) {
    const t = riga.trim();
    if (inBlocco) {
      const fine = t.indexOf('*/');
      if (fine === -1) continue;
      if (fine !== t.length - 2) return testo;
      inBlocco = false;
      continue;
    }
    if (t.startsWith('/*')) {
      const fine = t.indexOf('*/', 2);
      if (fine === -1) { inBlocco = true; continue; }
      if (fine !== t.length - 2) return testo;
      continue;
    }
    if (t.startsWith('//') || t === '') continue;
    uscita.push(riga);
  }
  return inBlocco ? testo : `${uscita.join('\n')}\n`;
}

export function cssSenzaCommenti(testo) {
  // Un «/*» dentro una stringa CSS non è un commento: in quel caso meglio non toccare niente.
  if (/["'][^"'\n]*\/\*/.test(testo)) return testo;
  return `${testo.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((r) => r.trim()).filter(Boolean).join('\n')}\n`;
}
