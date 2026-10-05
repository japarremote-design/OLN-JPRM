// Aplikasi peserta. Jawaban disimpan di HP (localStorage) dan dikirim SEKALI saat selesai,
// supaya hemat kuota Firestore gratis dan tetap aman bila sinyal putus / aplikasi tertutup.
const app = $('#app');
const KEY = 'lcc_state_v2';
let cfg = null, layar = '', st = muat();
let paket = null, urutan = [], opsiMap = {}, timerInt = null, dimuat = false, mengirim = false, sibuk = false;

function muat() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function simpan() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

docConfig.onSnapshot(s => {
  cfg = s.data() || {};
  $('#judul').textContent = cfg.judul || DEFAULT_JUDUL; document.title = cfg.judul || DEFAULT_JUDUL;
  route();
}, err => { app.innerHTML = `<div class="card center">Tidak bisa terhubung ke server.<br><span class="mut">${esc(err.message)}</span><br><br><button class="btn" onclick="location.reload()">Muat ulang</button></div>`; });

function resetLokal() { clearInterval(timerInt); timerInt = null; dimuat = false; paket = null; urutan = []; opsiMap = {}; }

function route() {
  if (!cfg || mengirim) return;
  if (!cfg.sesi) return tampil('belum');
  if (st.sesi !== cfg.sesi) { // sesi baru (admin reset) → mulai dari awal, data diri dipertahankan
    st = { sesi: cfg.sesi, id: acakId(), nama: st.nama || '', asal: st.asal || '', jaw: {}, keluar: 0 };
    simpan(); resetLokal();
  }
  const status = cfg.status || 'menunggu';
  if (st.terkirim) { resetLokal(); return tampil('selesai'); }
  if (st.kirim) return kirim(false); // ada pengiriman yang tertunda
  if (!st.nama) return status === 'selesai' ? tampil('ditutup') : tampil('daftar');
  if (status === 'mulai') { if (sisaWaktu(cfg) <= 0) return st.mulai ? selesaikan(true) : tampil('ditutup'); return mulaiKerja(); }
  if (status === 'selesai') return st.mulai ? selesaikan(true) : tampil('ditutup');
  if (dimuat) resetLokal();
  if (layar !== 'daftar') tampil('tunggu');
}

function tampil(nama) {
  layar = nama;
  if (nama === 'belum') app.innerHTML = '<div class="card center"><div class="big">🛠️</div><h3>Lomba belum disiapkan panitia.</h3></div>';
  else if (nama === 'daftar') {
    app.innerHTML = `<div class="card">
      <h2 style="margin-top:0">Data Peserta</h2>
      <p class="mut">Isi dengan benar. Nama ini yang tampil di papan skor.</p>
      <form id="fDaftar">
        <label>Nama peserta / nama regu</label><input name="nama" required maxlength="60" autocomplete="name" value="${esc(st.nama)}">
        <label>Asal sekolah</label><input name="asal" required maxlength="80" value="${esc(st.asal)}">
        <button class="btn block" style="margin-top:16px">Simpan & lanjut</button>
      </form></div>`;
    $('#fDaftar').onsubmit = e => {
      e.preventDefault(); const f = e.target.elements;
      const nama = f.nama.value.trim().slice(0, 60), asal = f.asal.value.trim().slice(0, 80);
      if (!nama || !asal) return;
      st.nama = nama; st.asal = asal; simpan(); layar = ''; route();
    };
  } else if (nama === 'tunggu') {
    const mode = cfg.mode === 'soal' ? `${cfg.detikPerSoal || 30} detik per soal` : `${cfg.durasiMenit || 30} menit`;
    app.innerHTML = `<div class="card center">
      <p class="mut">Peserta:</p><h2 style="margin:0">${esc(st.nama)}</h2><p class="mut">${esc(st.asal)}</p>
      <div class="big">⏳</div><h3>Menunggu lomba dimulai panitia…</h3>
      <p class="mut">${cfg.jumlahSoal || 30} soal pilihan ganda · waktu ${mode}<br>Soal tampil otomatis, tidak perlu memuat ulang.</p></div>
      <div class="card"><b>Tata tertib</b><ul class="mut" style="padding-left:18px;margin:8px 0 0">
      <li>Jawaban terkunci begitu dipilih, tidak bisa diubah.</li>
      ${cfg.mode === 'soal' ? '<li>Setiap soal punya batas waktu. Jika habis, soal dianggap kosong dan otomatis lanjut.</li>' : '<li>Soal boleh dikerjakan tidak berurutan lewat nomor soal.</li>'}
      <li>Jangan keluar dari aplikasi — panitia dapat melihat jumlah keluar-aplikasi.</li>
      <li>Jika aplikasi tertutup atau sinyal hilang, buka lagi: jawaban tidak hilang.</li>
      <li>Saat waktu habis, jawaban dikirim otomatis.</li></ul></div>
      <button class="btn ghost block" id="gantiData">Ubah data diri</button>`;
    $('#gantiData').onclick = () => tampil('daftar');
  } else if (nama === 'selesai') {
    app.innerHTML = `<div class="card center"><div class="big">✅</div><h2>Terima kasih, ${esc(st.nama)}!</h2>
      <p class="mut">Jawaban Anda sudah diterima server.</p>
      <p class="mut">Hasil dan peringkat diumumkan panitia melalui papan skor.</p>
      <a class="btn ghost" href="papan.html">Lihat papan skor</a></div>`;
  } else if (nama === 'ditutup') {
    app.innerHTML = `<div class="card center"><div class="big">🔒</div><h2>Lomba sudah ditutup</h2><p class="mut">Silakan hubungi panitia.</p><a class="btn ghost" href="papan.html">Lihat papan skor</a></div>`;
  }
}

async function mulaiKerja() {
  if (dimuat) return; dimuat = true; layar = 'memuat';
  app.innerHTML = '<div class="card center mut">Menyiapkan soal…</div>';
  try {
    if (st.paketId === cfg.paketId && st.paket) paket = st.paket;
    else {
      await new Promise(r => setTimeout(r, Math.random() * 2500)); // sebar beban saat ribuan HP mulai bersamaan
      paket = await ambilPaket(cfg.paketId);
      st.paketId = cfg.paketId; st.paket = paket; simpan();
    }
    const ids = paket.soal.map(q => q.id);
    urutan = cfg.acakSoal ? seededShuffle(ids, st.id) : ids;
    paket.soal.forEach(q => { const base = q.o.map((_, i) => i); opsiMap[q.id] = cfg.acakOpsi ? seededShuffle(base, st.id + '|' + q.id) : base; });
    if (urutan.every(id => st.jaw[id] !== undefined)) return selesaikan(false);
    if (!st.mulai || !(st.idx >= 0 && st.idx < urutan.length) || (cfg.mode === 'soal' && st.jaw[urutan[st.idx]] !== undefined)) {
      st.idx = urutan.findIndex(id => st.jaw[id] === undefined); st.soalMulai = nowServer();
    }
    st.mulai = true; simpan();
    layar = 'kerja'; renderSoal();
    clearInterval(timerInt); timerInt = setInterval(tick, 250);
  } catch (e) {
    dimuat = false; layar = 'galat';
    app.innerHTML = `<div class="card center">Gagal memuat soal (${esc(e.message)}).<br><br><button class="btn" id="ulang">Coba lagi</button></div>`;
    $('#ulang').onclick = () => route();
  }
}
async function ambilPaket(id) {
  for (let i = 0; ; i++) {
    try {
      const s = await fs.collection('paket').doc(id).get({ source: 'server' });
      if (!s.exists) throw new Error('paket soal tidak ditemukan');
      return s.data();
    } catch (e) {
      if (i >= 4 || /tidak ditemukan|permission/i.test(e.message)) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1) + Math.random() * 2000));
    }
  }
}

function renderSoal() {
  const id = urutan[st.idx], q = paket.soal.find(x => x.id === id), n = urutan.length;
  const dijawab = urutan.filter(x => st.jaw[x] !== undefined).length;
  const sudah = st.jaw[id];
  const modeLomba = cfg.mode !== 'soal';
  app.innerHTML = `
    <div class="bar"><span class="pill">Soal ${st.idx + 1} / ${n}</span><span class="timer" id="tmr">--:--</span></div>
    <div class="progress"><i style="width:${(dijawab / n) * 100}%"></i></div>
    <div class="card">
      <div class="qtext">${esc(q.t)}</div>
      ${opsiMap[id].map((orig, pos) => `<button class="opt ${sudah === orig ? 'dipilih' : ''}" data-o="${orig}" ${sudah !== undefined ? 'disabled' : ''}><b>${HURUF[pos]}</b><span>${esc(q.o[orig])}</span></button>`).join('')}
      ${sudah !== undefined ? `<p class="mut center">${sudah === -1 ? 'Waktu soal ini habis.' : 'Jawaban sudah terkunci.'}</p>` : ''}
    </div>
    ${modeLomba ? `<div class="card"><div class="row"><button class="btn ghost" id="prev">‹ Sebelumnya</button><button class="btn ghost" id="next">Berikutnya ›</button></div>
      <div class="grid">${urutan.map((x, i) => `<button data-i="${i}" class="${st.jaw[x] !== undefined ? 'done' : ''} ${i === st.idx ? 'now' : ''}">${i + 1}</button>`).join('')}</div>
      <button class="btn dark block" id="kumpul" style="margin-top:12px">Selesai & kumpulkan (${dijawab}/${n})</button></div>` : ''}`;
  $$('.opt', app).forEach(b => b.onclick = () => pilih(id, +b.dataset.o));
  if (modeLomba) {
    const ke = i => { st.idx = i; simpan(); renderSoal(); };
    $('#prev').onclick = () => ke((st.idx - 1 + n) % n);
    $('#next').onclick = () => ke((st.idx + 1) % n);
    $$('.grid button', app).forEach(b => b.onclick = () => ke(+b.dataset.i));
    $('#kumpul').onclick = () => {
      const kosong = n - dijawab;
      if (confirm(kosong ? `Masih ada ${kosong} soal belum dijawab. Tetap kumpulkan?` : 'Kumpulkan jawaban sekarang?')) selesaikan(false);
    };
  }
  tick();
}

function pilih(id, orig) {
  if (sibuk || st.jaw[id] !== undefined || layar !== 'kerja') return;
  sibuk = true; st.jaw[id] = orig; simpan();
  $$('.opt', app).forEach(b => { b.disabled = true; if (+b.dataset.o === orig) b.classList.add('dipilih'); });
  setTimeout(() => { sibuk = false; lanjut(); }, 300);
}

function lanjut() {
  if (layar !== 'kerja') return;
  const n = urutan.length;
  if (cfg.mode === 'soal') {
    let i = st.idx; while (i < n && st.jaw[urutan[i]] !== undefined) i++;
    if (i >= n) return selesaikan(false);
    st.idx = i; st.soalMulai = nowServer(); simpan(); return renderSoal();
  }
  for (let s = 1; s <= n; s++) { const j = (st.idx + s) % n; if (st.jaw[urutan[j]] === undefined) { st.idx = j; simpan(); return renderSoal(); } }
  selesaikan(false);
}

function tick() {
  if (layar !== 'kerja') return;
  const total = sisaWaktu(cfg);
  if (total <= 0) return selesaikan(true);
  let tampilMs = total;
  if (cfg.mode === 'soal') {
    const sisaSoal = (st.soalMulai || nowServer()) + (cfg.detikPerSoal || 30) * 1000 - nowServer();
    tampilMs = Math.min(sisaSoal, total);
    const id = urutan[st.idx];
    if (sisaSoal <= 0 && !sibuk && st.jaw[id] === undefined) { st.jaw[id] = -1; simpan(); return lanjut(); }
  }
  const el = $('#tmr'); if (el) { el.textContent = fmtTime(tampilMs); el.classList.toggle('warn', tampilMs < 10000); }
}

// Tandai siap kirim lalu kirim; bila serentak karena waktu habis, diberi jeda acak agar server tidak dibanjiri
function selesaikan(otomatis) {
  clearInterval(timerInt); timerInt = null;
  if (!st.kirim && !st.terkirim) { st.kirim = true; simpan(); }
  kirim(otomatis);
}
async function kirim(denganJeda) {
  if (mengirim || st.terkirim) return; mengirim = true; layar = 'kirim'; clearInterval(timerInt);
  const n = Object.values(st.jaw).filter(v => v !== -1).length;
  app.innerHTML = `<div class="card center"><div class="big">📤</div><h3>Mengirim jawaban…</h3><p class="mut">${n} jawaban. Jangan tutup aplikasi.</p><p class="mut" id="kirimInfo"></p></div>`;
  if (denganJeda) await new Promise(r => setTimeout(r, Math.random() * 15000));
  const ref = fs.collection('jawaban').doc(st.id);
  const data = { sesi: st.sesi, nama: st.nama, asal: st.asal, jaw: st.jaw, keluar: st.keluar || 0, kirimAt: SERVER_TS };
  for (let i = 0; ; i++) {
    try {
      await Promise.race([ref.set(data), new Promise((_, rej) => setTimeout(() => rej(new Error('waktu tunggu habis')), 25000))]);
      break;
    } catch (e) {
      if (/permission/i.test(e.code || e.message)) {
        // Dokumen hanya boleh dibuat sekali → mungkin kiriman sebelumnya sudah masuk
        const ada = await ref.get().then(s => s.exists).catch(() => false);
        if (ada) break;
      }
      const info = $('#kirimInfo'); if (info) info.textContent = `Belum terkirim (${e.message}). Mencoba lagi otomatis…`;
      await new Promise(r => setTimeout(r, Math.min(30000, 2000 * (i + 1)) + Math.random() * 3000));
    }
  }
  st.terkirim = true; st.kirim = false; delete st.paket; simpan();
  mengirim = false; resetLokal(); tampil('selesai');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && layar === 'kerja') { st.keluar = (st.keluar || 0) + 1; simpan(); }
});
