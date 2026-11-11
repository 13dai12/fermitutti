// Aggiornamento completo contro una fonte finta: dati buoni e fonte guasta in tutti i modi previsti.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { avviaFonteFinta } from '../scripts/fonte-finta.mjs';
import { aggiorna, decidiPubblicazione, ORE_BATTITO, sorveglia, ORE_SORVEGLIANZA } from '../scripts/aggiorna.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

let fonte;
const cartelle = [];
before(async () => { fonte = await avviaFonteFinta(0); });
after(() => { fonte.server.close(); for (const c of cartelle) rmSync(c, { recursive: true, force: true }); });

function nuovaCartella() { const c = mkdtempSync(join(tmpdir(), 'fermitutti-')); cartelle.push(c); return c; }
const opz = (dataDir, scenario, extra = {}) => ({ fonteUrl: `${fonte.url}/rss?scenario=${scenario}`, fonteHtmlUrl: '', dataDir, tentativi: 1, attesaMs: 1, timeoutMs: 2000, log: () => {}, adesso: new Date('2026-11-11T10:00:00Z'), ...extra });
const leggi = (dir, f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

test('fonte buona: scrive i dati e pubblica', async () => {
  const dir = nuovaCartella();
  const r = await aggiorna({ ...opz(dir, 'ok'), fonteHtmlUrl: `${fonte.url}/pagina` });
  assert.equal(r.ok, true);
  assert.equal(r.pubblica, true);
  assert.equal(leggi(dir, 'scioperi.json').scioperi.length, 32);
  assert.equal(leggi(dir, 'stato.json').fonte_guasta_dal, null);
  assert.equal(leggi(dir, 'scioperi.json').scioperi.find((s) => s.id === '8579').note, "GARANTITI I VOLI DA E PER L'AEROPORTO DI BARI");
});

for (const scenario of ['vuoto', 'html', 'errore500', 'lentissimo', 'campi-mancanti', 'date-rotte', 'script', 'script-titolo', 'doctype', 'redirect', 'enorme', 'meta']) {
  test(`fonte guasta (${scenario}): i dati restano quelli buoni e viene segnalato`, async () => {
    const dir = nuovaCartella();
    await aggiorna(opz(dir, 'ok', { adesso: new Date('2026-11-11T09:00:00Z') }));
    const prima = readFileSync(join(dir, 'scioperi.json'), 'utf8');
    const r = await aggiorna(opz(dir, scenario));
    assert.equal(r.ok, false, `lo scenario ${scenario} doveva essere rifiutato`);
    assert.equal(readFileSync(join(dir, 'scioperi.json'), 'utf8'), prima, 'i dati non devono cambiare');
    const stato = leggi(dir, 'stato.json');
    assert.ok(stato.fonte_guasta_dal, 'deve risultare la fonte guasta');
    assert.ok(stato.ultimo_errore.messaggio.length > 5);
    assert.equal(r.pubblica, true, 'la prima segnalazione si pubblica');
    const ancora = await aggiorna(opz(dir, scenario, { adesso: new Date('2026-11-11T10:30:00Z') }));
    assert.equal(ancora.pubblica, false, 'le segnalazioni successive non ripubblicano');
    const tornata = await aggiorna(opz(dir, 'ok', { adesso: new Date('2026-11-11T11:00:00Z') }));
    assert.equal(tornata.ok, true);
    assert.equal(tornata.pubblica, true, 'quando la fonte torna si ripubblica');
    assert.equal(leggi(dir, 'stato.json').fonte_guasta_dal, null);
  });
}

test('feed con CRLF o unicode strano: accettato ma ripulito', async () => {
  for (const scenario of ['crlf', 'unicode']) {
    const dir = nuovaCartella();
    const r = await aggiorna(opz(dir, scenario));
    assert.equal(r.ok, true);
    const s = leggi(dir, 'scioperi.json').scioperi.find((x) => x.id === '8598');
    const invisibili = new RegExp(`[\r\n${String.fromCharCode(0x202e, 0x200b, 0x2028)}]`);
    assert.ok(!invisibili.test(s.categoria), JSON.stringify(s.categoria));
  }
});

test('archivio vuoto e fonte guasta: nessun file di dati inventato', async () => {
  const dir = nuovaCartella();
  const r = await aggiorna(opz(dir, 'errore500'));
  assert.equal(r.ok, false);
  assert.equal(existsSync(join(dir, 'scioperi.json')), false);
});

test('regole di pubblicazione', () => {
  const adesso = new Date('2026-11-11T10:00:00Z');
  const fresca = { ultima_pubblicazione: '2026-11-11T09:30:00Z' };
  assert.deepEqual(decidiPubblicazione({ cambiato: true, eraGuasta: false, guasta: false, forza: false, statoPrecedente: fresca, adesso }), { pubblica: true, motivo: 'dati cambiati' });
  assert.deepEqual(decidiPubblicazione({ cambiato: false, eraGuasta: false, guasta: false, forza: false, statoPrecedente: fresca, adesso }), { pubblica: false, motivo: 'nessuna novità' });
  assert.equal(decidiPubblicazione({ cambiato: false, eraGuasta: false, guasta: false, forza: false, statoPrecedente: { ultima_pubblicazione: '2026-11-11T03:59:00Z' }, adesso }).motivo, 'controllo periodico');
  assert.equal(decidiPubblicazione({ cambiato: false, eraGuasta: false, guasta: false, forza: false, statoPrecedente: { ultima_pubblicazione: '2026-11-10T22:50:00Z' }, adesso: new Date('2026-11-10T23:10:00Z') }).motivo, 'nuovo giorno', 'mezzanotte italiana passata');
  assert.equal(decidiPubblicazione({ cambiato: false, eraGuasta: false, guasta: false, forza: true, statoPrecedente: fresca, adesso }).motivo, 'richiesta manuale');
  assert.equal(decidiPubblicazione({ cambiato: false, eraGuasta: true, guasta: true, forza: false, statoPrecedente: fresca, adesso }).pubblica, false);
  assert.equal(ORE_BATTITO, 6);
});

// Sorveglianza da GitHub: legge solo lo stato pubblicato dal computer in Italia, senza scaricare niente.
const ORA = new Date('2026-11-12T12:00:00Z');
const oreFa = (h) => new Date(ORA.getTime() - h * 3600000).toISOString();
function cartellaConStato(stato) {
  const dir = nuovaCartella();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'stato.json'), JSON.stringify(stato));
  return dir;
}

test('sorveglianza: verifiche recenti e fonte buona, nessuna modifica e segnalazioni da chiudere', () => {
  const dir = cartellaConStato({ ultima_verifica_riuscita: oreFa(2), ultima_pubblicazione: oreFa(2), fonte_guasta_dal: null });
  const prima = readFileSync(join(dir, 'stato.json'), 'utf8');
  const r = sorveglia({ dataDir: dir, adesso: ORA, log: () => {} });
  assert.equal(r.ok, true);
  assert.equal(r.pubblica, false);
  assert.equal(readFileSync(join(dir, 'stato.json'), 'utf8'), prima, 'lo stato non si tocca');
  assert.equal(existsSync(join(dir, 'scioperi.json')), false, 'nessun file di dati inventato');
});

test('sorveglianza: il computer in Italia vede la fonte guasta, si avvisa senza ripubblicare', () => {
  const dir = cartellaConStato({ ultima_verifica_riuscita: oreFa(3), ultima_pubblicazione: oreFa(1), fonte_guasta_dal: oreFa(1), ultimo_errore: { quando: oreFa(1), messaggio: 'fonte non raggiungibile: HTTP 500' } });
  const prima = readFileSync(join(dir, 'stato.json'), 'utf8');
  const r = sorveglia({ dataDir: dir, adesso: ORA, log: () => {} });
  assert.equal(r.ok, false);
  assert.equal(r.pubblica, false);
  assert.equal(readFileSync(join(dir, 'stato.json'), 'utf8'), prima);
});

test('sorveglianza: nessuna verifica riuscita da troppe ore, avviso sul sito una volta sola', () => {
  const dir = cartellaConStato({ ultima_verifica_riuscita: oreFa(ORE_SORVEGLIANZA + 1), ultima_pubblicazione: oreFa(ORE_SORVEGLIANZA + 1), fonte_guasta_dal: null, scioperi_nel_feed: 30 });
  const r = sorveglia({ dataDir: dir, adesso: ORA, log: () => {} });
  assert.equal(r.ok, false);
  assert.equal(r.pubblica, true, 'la prima volta si pubblica, così il sito mostra l’avviso');
  const stato = leggi(dir, 'stato.json');
  assert.equal(stato.fonte_guasta_dal, ORA.toISOString());
  assert.equal(stato.ultima_verifica_riuscita, oreFa(ORE_SORVEGLIANZA + 1), 'la verifica riuscita resta quella vera');
  assert.equal(stato.scioperi_nel_feed, 30);
  assert.match(stato.ultimo_errore.messaggio, /computer in Italia/);
  const dopo = sorveglia({ dataDir: dir, adesso: new Date(ORA.getTime() + 2 * 3600000), log: () => {} });
  assert.equal(dopo.pubblica, false, 'due ore dopo non si ripubblica');
  assert.equal(leggi(dir, 'stato.json').fonte_guasta_dal, ORA.toISOString(), 'la data del guasto non cambia');
});

test('sorveglianza: senza nessuno stato la fonte risulta mai verificata', () => {
  const dir = nuovaCartella();
  const r = sorveglia({ dataDir: dir, adesso: ORA, log: () => {} });
  assert.equal(r.ok, false);
  assert.match(leggi(dir, 'stato.json').ultimo_errore.messaggio, /non risulta nessuna verifica riuscita/);
  assert.equal(existsSync(join(dir, 'scioperi.json')), false);
});
