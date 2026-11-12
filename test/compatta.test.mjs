// File serviti al browser senza commenti: si tolgono solo righe intere, e nel dubbio non si tocca niente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { jsSenzaCommenti, cssSenzaCommenti } from '../scripts/lib/compatta.mjs';
import { buildDiProva } from './costruisci.mjs';

const AI = String.fromCharCode(96);

test('JavaScript: via commenti di riga, blocchi e righe vuote; il codice resta identico', () => {
  const sorgente = ['// nota interna', '/**', ' * Spiegazione.', ' */', 'const a = 1; // resta: è dentro una riga di codice', '', '  /* blocco */', 'const url = "https://esempio.it/x";', 'export { a };'].join('\n');
  assert.equal(jsSenzaCommenti(sorgente), ['const a = 1; // resta: è dentro una riga di codice', 'const url = "https://esempio.it/x";', 'export { a };', ''].join('\n'));
});

test('JavaScript: nel dubbio il file resta com’è', () => {
  const testoSuPiuRighe = ['const t = ' + AI + 'prima riga', '// questa riga fa parte del testo', 'ultima' + AI + ';'].join('\n');
  assert.equal(jsSenzaCommenti(testoSuPiuRighe), testoSuPiuRighe);
  const codiceDopoIlCommento = ['/* inizio', 'fine */ const x = 1;'].join('\n');
  assert.equal(jsSenzaCommenti(codiceDopoIlCommento), codiceDopoIlCommento);
  const bloccoAperto = ['/* mai chiuso', 'const x = 1;'].join('\n');
  assert.equal(jsSenzaCommenti(bloccoAperto), bloccoAperto);
  const espressione = 'const r = /[' + "'" + AI + ']/g;';
  assert.equal(jsSenzaCommenti(espressione), espressione + '\n', 'un apice inverso in una classe di caratteri non conta');
});

test('CSS: via i commenti; con «/*» dentro una stringa non si tocca niente', () => {
  assert.equal(cssSenzaCommenti('/* nota */\na { color: red; }\n\n  /* altra\n nota */\nb { content: "x" / ""; }\n'), 'a { color: red; }\nb { content: "x" / ""; }\n');
  const strano = 'a::after { content: "/* non è un commento */"; }\n';
  assert.equal(cssSenzaCommenti(strano), strano);
});

test('nel sito generato JavaScript e CSS non hanno commenti, e i moduli restano collegati', async () => {
  const { uscita } = await buildDiProva();
  for (const f of readdirSync(join(uscita, 'js'))) {
    const t = readFileSync(join(uscita, 'js', f), 'utf8');
    assert.ok(!t.split('\n').some((r) => r.trim().startsWith('//') || r.trim().startsWith('/*')), `${f}: commenti rimasti`);
    assert.ok(!/from '\.\/[a-z0-9-]+\.mjs'/.test(t), `${f}: import non riscritti`);
  }
  for (const f of [join(uscita, 'stile.css'), join(uscita, 'widget', 'stile.css')]) assert.ok(!readFileSync(f, 'utf8').includes('/*'), f);
});
