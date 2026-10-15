// Rename + IP audit: fails on any classic-fighting-franchise term (anywhere in the repo and the Meme Brawl
// references in sibling projects) or any real-token brand string in shipped game files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
// patterns are assembled from fragments so this file never contains the banned words verbatim
const J = (...a) => a.join('');
export const FRANCHISE = new RegExp([J('k', 'ombat'), J('\\bm', 'ortal\\b'), J('fatal', 'it'), J('babal', 'it'), J('brutal', 'ity'), J('animal', 'it'), J('finish ', '(him|her)'), J('flawless ', 'victory'), J('test your ', 'might'),
  J('get over ', 'here'), J('\\bto', 'asty\\b'), J('scor', 'pion'), J('sub-?', 'zero'), J('rai', 'den'), J('liu ', 'kang'), J('kit', 'ana'), J('mil', 'eena'), J('shang ', 'tsung'), J('\\bgo', 'ro\\b'), J('shao ', 'kahn'),
  J('johnny ', 'cage'), J('sonya ', 'blade'), J('\\bj', 'ax\\b'), J('kung ', 'lao'), J('nether', 'realm'), J('out', 'world'), J('earth', 'realm'), J('\\bka', 'no\\b'), J('\\bm', 'k ?(1[01]|x|9)\\b')].join('|'), 'i');
export const BRANDS = new RegExp([J('pe', 'pe'), J('\\bdo', 'ge\\b'), J('doge', 'coin'), J('dogwif', 'hat'), J('\\bw', 'if\\b'), J('fart', 'coin'), J('pen', 'gu'), J('pud', 'gy'), J('balen', 'ciaga'), J('bullen', 'cia'), J('cash', 'cat'),
  J('coin', 'gecko'), J('gecko', 'terminal'), J('pump\\.', 'fun'), J('\\bsh', 'ib\\b'), J('-', 'ish\\b'), J('\\bpee', 'po\\b')].join('|'), 'i');
// legacy slugs that must keep working (old URL, GitHub repo, folder path); stripped before scanning
const LEGACY = new RegExp([J('meme-', 'kombat-mu\\.vercel\\.app'), J('Nagesy7/meme-', 'kombat'), J('workspace/meme-', 'kombat'), J('"meme-', 'kombat/src')].join('|'), 'g');
const TEXT = /\.(js|mjs|cjs|json|html|css|md|py|txt|svg|yml|yaml)$/i;
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  if (fs.statSync(dir).isFile()) { out.push(dir); return out; }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vercel', 'dist', 'proof', 'data'].includes(e.name)) continue;
    const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (TEXT.test(e.name) && e.name !== 'package-lock.json') out.push(p);
  }
  return out;
}
const hits = (files, re) => files.filter((f) => f !== SELF).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l.replace(LEGACY, '')]))
  .filter(([, , l]) => re.test(l)).map(([f, n, l]) => `${path.relative('/workspace', f)}:${n}: ${l.trim().slice(0, 120)}`);

test('no classic fighting-franchise names, moves, announcer lines or logos anywhere in Meme Brawl', () => {
  const W = '/workspace', ext = [`${W}/inu-verse/src`, `${W}/inu-verse/index.html`, `${W}/inu-verse/README.md`, `${W}/kibble-pay/config`, `${W}/kibble-pay/public`, `${W}/kibble-pay/api`, `${W}/kibble-pay/README.md`, `${W}/kibble-pay/docs`, `${W}/kibble-pay/scripts`, `${W}/inu/build.py`];
  const files = [...walk(ROOT), ...ext.flatMap((d) => walk(d))];
  assert.ok(files.length > 20);
  assert.deepEqual(hits(files, FRANCHISE), []);
});

test('no real memecoin names, tickers or brand marks in shipped game files', () => {
  const files = [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'index.html'), path.join(ROOT, 'style.css')];
  assert.deepEqual(hits(files, BRANDS), []);
});

test('product name is Meme Brawl in title, share card, package and menu', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<title>Meme Brawl/); assert.match(html, /og:title" content="Meme Brawl"/); assert.match(html, /meme-brawl\.vercel\.app/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name, 'meme-brawl');
  assert.match(fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8'), /'MEME BRAWL'/);
});

test('the audit actually catches banned terms (self-check)', () => {
  assert.ok(FRANCHISE.test(J('Meme K', 'ombat'))); assert.ok(FRANCHISE.test(J('FINISH ', 'HIM'))); assert.ok(FRANCHISE.test(J('Flawless ', 'Victory')));
  assert.ok(BRANDS.test(J('PE', 'PE-ish'))); assert.ok(!BRANDS.test('Wiffy the hat dog')); assert.ok(!FRANCHISE.test('Meme Brawl'));
});
