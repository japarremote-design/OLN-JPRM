// ====== GANTI dengan konfigurasi Firebase Anda (Project settings > Your apps > Web) ======
const firebaseConfig = {
  apiKey: "AIzaSyAto5rTyJV9yit5L0VD8ghR1HxwGQI5LA8",
  authDomain: "oln-jprm.firebaseapp.com",
  projectId: "oln-jprm",
  appId: "1:862417144601:web:dab7bf9c7154fcdf6f9388"
};
// ====== (Opsional, untuk soal bergambar) Cloudinary: cloud name + unsigned upload preset ======
// Cloudinary > Settings > Upload > Add upload preset > Signing mode: Unsigned
const CLOUDINARY = { cloud: "", preset: "" };
// =========================================================================================

const LINK_RADAR = 'https://radarmadura.jawapos.com/';
const DEFAULT_JUDUL = 'Olimpiade Literasi dan Numerasi Tingkat SD · Hari Jadi Bangkalan ke-495';

firebase.initializeApp(firebaseConfig);
const fs = firebase.firestore();
if (window.LCC_PERSIST) fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
const SERVER_TS = firebase.firestore.FieldValue.serverTimestamp();
const docConfig = fs.collection('config').doc('lomba');
const docPapan = fs.collection('publik').doc('papan');

// Selisih jam HP vs jam server (header Date hosting) supaya timer semua peserta sama
let serverOffset = 0;
(async function sinkronJam() {
  try {
    const t0 = Date.now();
    const r = await fetch(location.origin + '/manifest.json?t=' + t0, { method: 'HEAD', cache: 'no-store' });
    const d = Date.parse(r.headers.get('date')); const t1 = Date.now();
    if (d) serverOffset = d + 500 - (t0 + t1) / 2;
  } catch (e) { /* pakai jam HP */ }
})();
const nowServer = () => Date.now() + serverOffset;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HURUF = ['A', 'B', 'C', 'D'];
const tsMs = v => v && typeof v.toMillis === 'function' ? v.toMillis() : (typeof v === 'number' ? v : 0);
const acakId = (n = 20) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('');

// Header berlogo: klik logo → radarmadura.jawapos.com. Di bawahnya deretan logo mitra.
const MITRA = [['logo-495.png', 'Hari Jadi Kabupaten Bangkalan ke-495'], ['logo-bangkalan.png', 'Pemerintah Kabupaten Bangkalan'], ['logo-dinas.png', 'Dinas Pendidikan Kabupaten Bangkalan']];
function buatHeader(label) {
  const h = document.getElementById('hdr'); if (!h) return;
  h.className = 'top';
  h.innerHTML = `<div class="in"><a class="logo" href="${LINK_RADAR}" target="_blank" rel="noopener" title="Buka RadarMadura.id"><img src="logo.png" alt="RadarMadura.id – Berita Madura Tepercaya"></a>
    <div class="tt"><small>${esc(label)}</small><h1 id="judul">${esc(DEFAULT_JUDUL)}</h1></div></div>
    <div class="mitra">${MITRA.map(([f, a]) => `<img src="${f}" alt="${esc(a)}" loading="lazy">`).join('')}</div>`;
}
function setJudul(j) { const e = $('#judul'); if (e) e.textContent = j || DEFAULT_JUDUL; document.title = (j || DEFAULT_JUDUL).split('·')[0].trim(); }

// ---- Identitas peserta (tanpa kode): ID dokumen = hash dari nama + kelas + sekolah ----
const KELAS_LOMBA = ['3', '4', '5'];
const rapiNama = s => String(s || '').replace(/[.,'’`"]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
const normSekolah = s => String(s || '').toUpperCase().replace(/^UPTD\s+/, '').replace(/[.,'’`"]/g, ' ').replace(/\s+/g, ' ').trim();
function hash128(str) { // hash deterministik 128 bit (4 × 32 bit) → 24 hex karakter dipakai
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); h3 = Math.imul(h3 ^ c, 2246822519); h4 = Math.imul(h4 ^ c, 3266489917);
    h1 = (h1 << 13 | h1 >>> 19) ^ h4; h2 = (h2 << 11 | h2 >>> 21) ^ h1; h3 = (h3 << 7 | h3 >>> 25) ^ h2; h4 = (h4 << 17 | h4 >>> 15) ^ h3;
  }
  return [h1, h2, h3, h4].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
const idPeserta = (nama, kelas, sekolah) => hash128(rapiNama(nama) + '|' + String(kelas) + '|' + normSekolah(sekolah)).slice(0, 24);
// Cocokkan nama sekolah (dari Excel) dengan daftar resmi → nama resmi, atau null
function sekolahResmi(nama, kec) {
  const n = normSekolah(nama); if (!n || typeof DATA_SEKOLAH === 'undefined') return null;
  for (const [k, list] of DATA_SEKOLAH) { if (kec && k.toLowerCase() !== String(kec).toLowerCase()) continue; const f = list.find(x => normSekolah(x) === n); if (f) return { kec: k, sekolah: f }; }
  return null;
}

// ---- Gambar & opsi ----
const urlAman = u => /^(https:\/\/|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(u || '') ? u : '';
const normOpsi = o => typeof o === 'string' ? { t: o, g: '' } : { t: String((o && o.t) ?? ''), g: String((o && o.g) ?? '') };
function opsiAdaIsi(o) { return !!(String(o.t || '').trim() || o.g); }

// ---- Acak konsisten per peserta ----
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

// ---- Waktu ----
function fmtTime(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
const fmtJam = ms => ms ? new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
const fmtTgl = ms => ms ? new Date(ms).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '-';
// <input type="datetime-local"> ↔ ms (zona waktu perangkat; admin di WIB)
const keInputWaktu = ms => { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const dariInputWaktu = v => v ? new Date(v).getTime() : null;

// ---- Aturan jendela waktu / serentak ----
// cfg.jadwal: 'jendela' (tiap peserta mulai sendiri antara bukaAt–tutupAt) | 'serentak' (admin menekan Mulai)
function bolehMulai(cfg, t = nowServer()) {
  if (cfg.status !== 'mulai') return false;
  if (cfg.jadwal === 'serentak') return true;
  return (!cfg.bukaAt || t >= cfg.bukaAt) && (!cfg.tutupAt || t < cfg.tutupAt);
}
function batasPeserta(cfg, mulaiPeserta) {
  if (cfg.jadwal === 'serentak') return tsMs(cfg.mulaiAt) + (cfg.durasiTotalMs || 0);
  let b = (mulaiPeserta || 0) + (cfg.durasiTotalMs || 0);
  if (cfg.tutupAt) b = Math.min(b, cfg.tutupAt + 10 * 60000); // toleransi 10 menit setelah jendela ditutup
  return b;
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }
const urutkanSkor = arr => arr.sort((a, b) => b.skor - a.skor || b.benar - a.benar || (a.durasiMs ?? 9e15) - (b.durasiMs ?? 9e15) || String(a.nama).localeCompare(String(b.nama)));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
