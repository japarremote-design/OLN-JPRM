// ====== GANTI dengan konfigurasi Firebase Anda (Project settings > Your apps > Web) ======
const firebaseConfig = {
  apiKey: "ISI_API_KEY",
  authDomain: "ISI_PROJECT.firebaseapp.com",
  projectId: "ISI_PROJECT",
  appId: "ISI_APP_ID"
};
// =========================================================================================

firebase.initializeApp(firebaseConfig);
const fs = firebase.firestore();
// Halaman admin menyimpan cache lokal agar muat ulang tidak membaca ulang ribuan dokumen
if (window.LCC_PERSIST) fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
const SERVER_TS = firebase.firestore.FieldValue.serverTimestamp();
const DEFAULT_JUDUL = 'Olimpiade Literasi dan Numerasi Tingkat SD · Hari Jadi Bangkalan ke-495';
const docConfig = fs.collection('config').doc('lomba');
const docPapan = fs.collection('publik').doc('papan');

// Selisih jam HP vs jam server (dari header Date hosting) supaya timer semua peserta sama
let serverOffset = 0;
(async function sinkronJam() {
  try {
    const t0 = Date.now();
    const r = await fetch(location.origin + '/manifest.json?t=' + t0, { method: 'HEAD', cache: 'no-store' });
    const d = Date.parse(r.headers.get('date')); const t1 = Date.now();
    if (d) serverOffset = d + 500 - (t0 + t1) / 2; // header Date dibulatkan ke detik
  } catch (e) { /* pakai jam HP */ }
})();
const nowServer = () => Date.now() + serverOffset;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HURUF = ['A', 'B', 'C', 'D'];
const tsMs = v => v && typeof v.toMillis === 'function' ? v.toMillis() : (typeof v === 'number' ? v : 0);
const acakId = (n = 20) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');

function seedFrom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function seededShuffle(arr, seedStr) {
  const rnd = mulberry32(seedFrom(seedStr)); const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function fmtTime(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(t / 60), s = t % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function fmtJam(ms) { return ms ? new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'; }
function sisaWaktu(cfg) { return tsMs(cfg.mulaiAt) + (cfg.durasiTotalMs || 0) - nowServer(); }
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
function urutkanSkor(arr) {
  return arr.sort((a, b) => b.skor - a.skor || b.benar - a.benar || (a.durasiMs ?? 9e15) - (b.durasiMs ?? 9e15) || String(a.nama).localeCompare(b.nama));
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
