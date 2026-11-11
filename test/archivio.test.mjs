// Archivio: stati (confermato, revocato, rinviato, tolto, concluso), numeri di sequenza e pulizia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unisci, archivioVuoto, attesiNelFeed, statoMostrato, GIORNI_CONSERVAZIONE } from '../scripts/lib/archivio.mjs';
import { elabora, feedCon, FINTI, FEED_REALE, archivioDiProva } from './aiuto.mjs';

test('primo aggiornamento: tutti nuovi e confermati', () => {
  const r = elabora(FEED_REALE, archivioVuoto(), '2026-11-10T22:00:00.000Z');
  assert.equal(r.diff.aggiunti.length, 32);
  assert.ok(r.archivio.scioperi.every((s) => s.stato === 'confermato' && s.sequence === 0));
  assert.equal(new Set(r.archivio.scioperi.map((s) => s.slug)).size, 32, 'indirizzi unici');
  assert.equal(r.cambiato, true);
});

test('nessuna novità: nulla cambia', () => {
  const primo = elabora(FEED_REALE, archivioVuoto(), '2026-11-10T22:00:00.000Z');
  const secondo = elabora(FEED_REALE, primo.archivio, '2026-11-10T22:30:00.000Z');
  assert.equal(secondo.cambiato, false);
  assert.equal(secondo.urgente, false);
  assert.equal(secondo.archivio.aggiornato_il, primo.archivio.aggiornato_il);
});

test('modifica di un campo: sequenza +1 e storia', () => {
  const primo = elabora(FEED_REALE, archivioVuoto(), '2026-11-10T22:00:00.000Z');
  const xml = FEED_REALE.replace('modalità: 4 ORE: DALLE 16.00 ALLE 20.00', 'modalità: 4 ORE: DALLE 17.00 ALLE 21.00');
  const secondo = elabora(xml, primo.archivio, '2026-11-10T23:00:00.000Z');
  const s = secondo.archivio.scioperi.find((x) => x.id === '8637');
  assert.equal(s.sequence, 1);
  assert.equal(s.orario.dalle, '17:00');
  assert.equal(s.storia.at(-1).tipo, 'modificato');
  assert.equal(secondo.urgente, true);
});

test('sparito prima di iniziare: revocato; ricompare: ripristinato', () => {
  const a = archivioDiProva();
  const s = a.scioperi.find((x) => x.id === '9001');
  assert.equal(s.stato, 'revocato');
  assert.equal(s.sequence, 1);
  const di = elabora(feedCon(FINTI[9001], FINTI[9003]), a, '2026-11-11T12:00:00.000Z');
  const ripristinato = di.archivio.scioperi.find((x) => x.id === '9001');
  assert.equal(ripristinato.stato, 'confermato');
  assert.equal(ripristinato.sequence, 2);
  assert.ok(di.diff.ripristinati.includes('9001'));
});

test('rinvio con un nuovo codice: il vecchio rimanda al nuovo', () => {
  const a = archivioDiProva();
  const vecchio = a.scioperi.find((x) => x.id === '9002');
  const nuovo = a.scioperi.find((x) => x.id === '9003');
  assert.equal(vecchio.stato, 'differito');
  assert.equal(vecchio.differito_a, nuovo.slug);
  assert.equal(nuovo.differito_da, vecchio.slug);
  assert.equal(nuovo.inizio_precedente, '2026-11-19');
});

test('stessa data cambiata sullo stesso codice: rinviato', () => {
  const primo = elabora(feedCon(FINTI[9001]), archivioVuoto(), '2026-11-10T22:00:00.000Z');
  const spostato = FINTI[9001].replace(/18\/11\/2026/g, '25/11/2026');
  const secondo = elabora(feedCon(spostato), primo.archivio, '2026-11-11T08:00:00.000Z');
  const s = secondo.archivio.scioperi.find((x) => x.id === '9001');
  assert.equal(s.stato, 'differito');
  assert.equal(s.inizio_precedente, '2026-11-18');
  assert.equal(s.inizio, '2026-11-25');
  assert.ok(secondo.diff.rinviati.includes('9001'));
});

test('sparito durante lo sciopero: tolto dal calendario; sparito dopo: concluso', () => {
  const primo = elabora(FEED_REALE, archivioVuoto(), '2026-11-10T08:00:00.000Z');
  const senza8637 = FEED_REALE.replace(/<item>(?:(?!<\/item>)[\s\S])*?scioperi\.mit\.gov\.it\/8637[\s\S]*?<\/item>/, '');
  const durante = elabora(senza8637, primo.archivio, '2026-11-10T15:00:00.000Z');
  assert.equal(durante.archivio.scioperi.find((x) => x.id === '8637').stato, 'rimosso');
  const dopo = elabora(senza8637, primo.archivio, '2026-11-12T08:00:00.000Z');
  const concluso = dopo.archivio.scioperi.find((x) => x.id === '8637');
  assert.equal(concluso.stato, 'confermato');
  assert.ok(concluso.rimosso_il);
  assert.equal(statoMostrato(concluso, '2026-11-12'), 'concluso');
  assert.ok(dopo.diff.conclusi.includes('8637'));
});

test('pulizia: gli scioperi conclusi da più di 60 giorni escono dall\'archivio', () => {
  const primo = elabora(FEED_REALE, archivioVuoto(), '2026-11-10T08:00:00.000Z');
  const tardi = unisci(primo.archivio, [], { adesso: '2027-03-30T08:00:00.000Z', oggi: '2027-03-30' });
  assert.equal(tardi.archivio.scioperi.length, 0);
  assert.equal(GIORNI_CONSERVAZIONE, 60);
});

test('scioperi attesi nel feed (per il controllo sul calo improvviso)', () => {
  const a = archivioDiProva();
  assert.equal(attesiNelFeed(a, '2026-11-11'), 30);
  assert.equal(attesiNelFeed(archivioVuoto(), '2026-11-11'), 0);
});
