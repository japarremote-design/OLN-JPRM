// Pembaruan otomatis: begitu versi baru aplikasi aktif, halaman dimuat ulang sekali (tidak saat ujian berlangsung)
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) { let sudah = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (sudah) return; if (document.body && document.body.classList.contains('ujian')) return; sudah = true; location.reload(); }); }
// Ikon SVG (emoji tidak tampil di PC/Windows lama)
const IKON = { ok: ['#16a34a', '<circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.2 3.2L17 9"/>'], kunci: ['#0077B5', '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'], stop: ['#dc2626', '<circle cx="12" cy="12" r="10"/><path d="M5 5l14 14"/>'], jam: ['#0093DD', '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'], mulai: ['#16a34a', '<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z"/>'], alat: ['#FFA60C', '<circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/>'], info: ['#0093DD', '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.5v.5"/>'], kirim: ['#0093DD', '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>'] };
const ikon = k => { const [w, p] = IKON[k] || IKON.info; return `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="${w}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`; };
// Aplikasi peserta. Login: nama lengkap + kelas + kecamatan + sekolah (pilih dari daftar). Soal sesuai kelas.
// Jawaban disimpan di HP (localStorage) dan dikirim SEKALI saat selesai → hemat kuota & tahan sinyal putus.
buatHeader('Jawa Pos Radar Madura · Peserta');
const app = $('#app');
const KEY = 'lcc_state_v3', KEY_DEV = 'lcc_dev';
let cfg = null, layar = '', st = muat(), calon = null;
let paket = null, urutan = [], opsiMap = {}, timerInt = null, bangunInt = null;
let dimuat = false, mengirim = false, sibuk = false, gantiBusy = false;

function muat() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function simpan() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
function idPerangkat() {
  try { let d = localStorage.getItem(KEY_DEV); if (!d) { d = acakId(16); localStorage.setItem(KEY_DEV, d); } return d; } catch (e) { return acakId(16); }
}
const DEV = idPerangkat();
// Kontak panitia: dinonaktifkan (null). Untuk mengaktifkan lagi, isi { nama, wa: '62...', tampil: '+62 ...' }
const KONTAK = null;
const batasKeluar = () => cfg && cfg.batasKeluar != null ? Math.max(0, +cfg.batasKeluar || 0) : 3; // 0 = tidak dibatasi
const JEDA_KELUAR = 2000; // keluar < 2 detik (mis. sentuhan tak sengaja) tidak dihitung
const kontakHtml = () => {
  if (!KONTAK) return '';
  const teks = `Halo panitia OLN, saya mau melapor.\nNama: ${st.nama || ''}\nKelas: ${st.kelas || ''}\nSekolah: ${st.sekolah || ''}\nKecamatan: ${st.kec || ''}\nKendala: `;
  return `<div class="card"><b>Ada kendala? Hubungi panitia</b>
    <p class="mut" style="margin:6px 0 4px">${esc(KONTAK.nama)} · <b>${esc(KONTAK.tampil)}</b></p>
    <ul class="mut" style="padding-left:18px;margin:4px 0 12px"><li>Hanya melayani lewat chat WhatsApp.</li><li>Pengaduan wajib mencantumkan nama sekolah dan kecamatan.</li><li>Boleh dikirim lewat voice note.</li></ul>
    <a class="btn wa block" href="https://wa.me/${KONTAK.wa}?text=${encodeURIComponent(teks)}" target="_blank" rel="noopener">Chat WhatsApp Panitia</a></div>`;
};
const denganWaktu = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('koneksi lambat / terputus')), ms))]);

docConfig.onSnapshot(s => { cfg = s.data() || {}; setJudul(cfg.judul); route(); },
  err => { app.innerHTML = `<div class="card center">Tidak bisa terhubung ke server.<br><span class="mut">${esc(err.message)}</span><br><br><button class="btn" onclick="location.reload()">Muat ulang</button></div>`; });

function resetLokal() { clearInterval(timerInt); timerInt = null; dimuat = false; paket = null; urutan = []; opsiMap = {}; }

function route() {
  if (!cfg || mengirim) return;
  clearTimeout(bangunInt);
  if (!st.kode) return tampil('masuk');
  if (!cfg.sesi) return tampil('belum');
  if (st.sesi !== cfg.sesi) return gantiSesi();
  // final: wajib punya kunci login perangkat, dan kunci diperiksa ulang sekali tiap aplikasi dibuka (sebelum mulai mengerjakan)
  if (cfg.babak === 'final' && st.finalis && !st.mulai && !st.terkirim && (st.kunci !== cfg.sesi || kunciCek !== cfg.sesi)) { st.sesi = ''; return gantiSesi(); }
  if (cfg.babak === 'final' && !st.finalis) return tampil('tidaklolos');
  if (!(cfg.paketKelas || {})[st.kelas] && cfg.status === 'mulai') return tampil('tanpasoal');
  if (st.terkirim) { resetLokal(); return tampil('selesai'); }
  if (st.kirim) return kirim(false);
  const t = nowServer();
  if (st.mulai) { // sedang mengerjakan
    if (cfg.status === 'selesai' || t >= batasPeserta(cfg, st.mulai)) return selesaikan(true);
    return mulaiKerja();
  }
  if (cfg.status === 'selesai') return tampil('ditutup');
  if (cfg.status === 'mulai' && cfg.jadwal !== 'serentak' && cfg.tutupAt && t >= cfg.tutupAt) return tampil('ditutup');
  if (!bolehMulai(cfg, t)) { tampil('tunggu'); jadwalkanBangun(t); return; }
  if (cfg.jadwal === 'serentak') return mulaiKerja();
  if (!dimuat) tampil('siap');
}
function jadwalkanBangun(t) {
  const next = [cfg.bukaAt, cfg.tutupAt].filter(x => x && x > t).sort((a, b) => a - b)[0];
  if (next && cfg.status === 'mulai') bangunInt = setTimeout(route, Math.min(next - t + 400, 2000000000));
}

async function gantiSesi() {
  if (gantiBusy) return; gantiBusy = true;
  const dasar = { dev: DEV, kode: st.kode, nama: st.nama, kelas: st.kelas, sekolah: st.sekolah, kec: st.kec, finalis: st.finalis };
  if (cfg.babak === 'final') {
    // Final: satu peserta hanya boleh login di satu perangkat. Perangkat pertama yang masuk memegang kunci; perangkat lain ditolak.
    st = { ...dasar, sesi: '', jaw: {}, keluar: 0 }; resetLokal();
    const sesiIni = cfg.sesi;
    try {
      const d = await ambilPeserta(st.kode); if (d) st.finalis = !!d.finalis;
      if (st.finalis) {
        if (!(await kunciLogin(sesiIni))) { simpan(); gantiBusy = false; return tampil('loginbeda'); }
        st.kunci = sesiIni; kunciCek = sesiIni;
      }
    } catch (e) { galatLogin = e.message; simpan(); gantiBusy = false; return tampil('loginerr'); }
    st.sesi = sesiIni;
  } else { st = { ...dasar, sesi: cfg.sesi, jaw: {}, keluar: 0 }; resetLokal(); }
  simpan(); gantiBusy = false; route();
}
let galatLogin = '', kunciCek = '';
async function kunciLogin(sesi) {
  const ref = fs.collection('loginfinal').doc(sesi + '_' + st.kode);
  const s = await denganWaktu(ref.get({ source: 'server' }), 15000);
  if (s.exists) return s.data().dev === DEV;
  try { await denganWaktu(ref.set({ dev: DEV, at: SERVER_TS }), 15000); return true; }
  catch (e) { // balapan: perangkat lain mendahului
    const s2 = await ref.get({ source: 'server' }).catch(() => null);
    if (s2 && s2.exists) return s2.data().dev === DEV;
    throw e;
  }
}
async function ambilPeserta(kode) {
  const s = await denganWaktu(fs.collection('peserta').doc(kode).get({ source: 'server' }), 15000);
  return s.exists ? s.data() : null;
}

function tampil(nama) {
  layar = nama; document.body.classList.remove('ujian');
  if (nama === 'belum') app.innerHTML = `<div class="card center"><div class="big">${ikon('alat')}</div><h3>Lomba belum disiapkan panitia.</h3></div>`;
  else if (nama === 'masuk') {
    const kecs = DATA_SEKOLAH.map(x => x[0]);
    app.innerHTML = `<div class="card">
      <h2 style="margin-top:0">Masuk Peserta</h2>
      <p class="mut">Isi data dengan benar, sama seperti di data sekolah. ${cfg.babak === 'final' ? 'Akun ini hanya bisa dipakai di satu perangkat; perangkat lain akan ditolak.' : 'Setelah mulai mengerjakan, nama ini tidak bisa dipakai di HP lain.'}</p>
      <form id="fMasuk" autocomplete="off">
        <label>Nama lengkap</label><input name="nama" maxlength="60" autocapitalize="words" spellcheck="false" placeholder="Nama lengkap siswa" required>
        <label>Kelas</label><select name="kelas" required><option value="">— pilih kelas —</option>${KELAS_LOMBA.map(k => `<option value="${k}">Kelas ${k}</option>`).join('')}</select>
        <label>Kecamatan</label><select name="kec" required><option value="">— pilih kecamatan —</option>${kecs.map(k => `<option>${esc(k)}</option>`).join('')}</select>
        <label>Nama sekolah</label><select name="sekolah" required disabled><option value="">— pilih kecamatan dulu —</option></select>
        <button class="btn block" style="margin-top:16px">Lanjut</button></form>
      <p id="pesan" class="warn center"></p></div>
      ${kontakHtml()}
      <p class="mut center"><a href="${LINK_RADAR}" target="_blank" rel="noopener">Baca berita di RadarMadura.id</a></p>`;
    const f = $('#fMasuk').elements;
    f.kec.onchange = () => {
      const row = DATA_SEKOLAH.find(x => x[0] === f.kec.value);
      f.sekolah.innerHTML = row ? '<option value="">— pilih sekolah —</option>' + row[1].map(x => `<option>${esc(x)}</option>`).join('') : '<option value="">— pilih kecamatan dulu —</option>';
      f.sekolah.disabled = !row;
    };
    $('#fMasuk').onsubmit = async e => {
      e.preventDefault(); const pesan = $('#pesan'), btn = e.target.querySelector('button');
      const nama = f.nama.value.replace(/\s+/g, ' ').trim();
      if (nama.length < 3 || !/\p{L}/u.test(nama)) { pesan.textContent = 'Tulis nama lengkap siswa.'; return; }
      btn.disabled = true; pesan.textContent = '';
      const data = { n: nama.toUpperCase().slice(0, 60), k: f.kelas.value, kc: f.kec.value, s: f.sekolah.value };
      const kode = idPeserta(data.n, data.k, data.s);
      try {
        let d = await ambilPeserta(kode);
        if (!d) {
          if (cfg.daftarMandiri === false) { pesan.textContent = 'Data kamu belum terdaftar. Hubungi panitia atau guru pendamping.'; btn.disabled = false; return; }
          d = { ...data, ...(cfg.babak === 'gladi' ? { g: true } : {}) };
          await denganWaktu(fs.collection('peserta').doc(kode).set(d), 15000); // pendaftaran mandiri
        }
        calon = { kode, d }; tampil('konfirmasi');
      } catch (err) { pesan.textContent = 'Gagal terhubung: ' + err.message; btn.disabled = false; }
    };
  } else if (nama === 'konfirmasi') {
    const d = calon.d;
    app.innerHTML = `<div class="card center"><p class="mut">Apakah ini data kamu?</p>
      <h2 style="margin:4px 0">${esc(d.n)}</h2>
      <p style="margin:2px 0"><b>Kelas ${esc(d.k)}</b> · ${esc(d.s)}</p><p class="mut" style="margin:2px 0">Kecamatan ${esc(d.kc)}</p>
      <div class="row" style="margin-top:16px"><button class="btn ghost" id="bBukan">Ubah data</button><button class="btn" id="bYa">Ya, ini saya</button></div></div>`;
    $('#bBukan').onclick = () => { calon = null; tampil('masuk'); };
    $('#bYa').onclick = () => {
      st = { dev: DEV, kode: calon.kode, nama: d.n, kelas: d.k, sekolah: d.s, kec: d.kc, finalis: !!d.finalis, sesi: '', jaw: {}, keluar: 0 };
      calon = null; simpan(); route();
    };
  } else if (nama === 'tunggu') {
    let info = '';
    if (cfg.status !== 'mulai') info = 'Lomba belum dibuka panitia.';
    else if (cfg.bukaAt && nowServer() < cfg.bukaAt) info = `Dibuka ${fmtTgl(cfg.bukaAt)}.`;
    app.innerHTML = `<div class="card center">${identitasHtml()}
      <div class="big">${ikon('jam')}</div><h3>${info || 'Menunggu lomba dimulai panitia…'}</h3>
      <p class="mut">${esc(babakNama())} · ${cfg.jumlahSoal || 50} soal pilihan ganda · ${durasiTeks()}${cfg.tutupAt ? `<br>Ditutup ${fmtTgl(cfg.tutupAt)}` : ''}<br>Halaman ini otomatis berubah saat lomba dibuka.</p></div>${aturanHtml()}${kontakHtml()}${tombolKeluar()}`;
    pasangKeluar();
  } else if (nama === 'siap') {
    app.innerHTML = `<div class="card center">${identitasHtml()}
      <div class="big">${ikon('mulai')}</div><h3>Lomba sudah dibuka</h3>
      <p class="mut">${esc(babakNama())} · ${cfg.jumlahSoal || 50} soal · ${durasiTeks()}${cfg.tutupAt ? `<br>Terakhir mulai sebelum ${fmtTgl(cfg.tutupAt)}` : ''}</p>
      <p><b>Waktu mulai berjalan saat kamu menekan tombol di bawah.</b></p>
      <button class="btn or block" id="bMulai" style="font-size:18px;padding:16px">Mulai Mengerjakan</button></div>${aturanHtml()}${kontakHtml()}${tombolKeluar()}`;
    $('#bMulai').onclick = () => { $('#bMulai').disabled = true; mulaiKerja(); };
    pasangKeluar();
  } else if (nama === 'selesai') {
    const henti = st.henti ? `<div class="card" style="border-color:#dc2626"><b>Ujian berakhir otomatis</b><p class="mut" style="margin:6px 0 10px">Kamu keluar dari aplikasi ${(st.keluar || 0) - (st.dasarKeluar || 0)} kali, sehingga jawaban yang sudah terisi langsung dikumpulkan. Jika ini karena kendala teknis, laporkan ke panitia. Bila panitia memberi kesempatan, tekan tombol di bawah.</p>
      <button class="btn ghost block" id="bIzin">Panitia sudah memberi izin? Cek di sini</button><p class="warn center" id="izinMsg" style="margin:8px 0 0"></p></div>${kontakHtml()}` : '';
    app.innerHTML = `<div class="card center"><div class="big">${ikon('ok')}</div><h2>Terima kasih, ${esc(st.nama)}!</h2>
      <p class="mut">Jawabanmu sudah diterima server.</p>
      ${hasilHtml()}<p class="mut">Hasil diumumkan panitia dan Jawa Pos Radar Madura.</p>
      <a class="btn ghost" href="${LINK_RADAR}" target="_blank" rel="noopener">Buka RadarMadura.id</a> <a class="btn ghost" href="papan.html">Papan skor</a></div>${henti}
      <p class="center mut">HP dipakai bergantian? Peserta berikutnya bisa masuk dengan datanya sendiri.</p>${tombolKeluar('Peserta berikutnya')}`;
    pasangKeluar();
    const bi = $('#bIzin'); if (bi) bi.onclick = cekIzin;
  } else if (nama === 'ditutup') {
    app.innerHTML = `<div class="card center"><div class="big">${ikon('kunci')}</div><h2>Lomba sudah ditutup</h2><p class="mut">${esc(st.nama)}, silakan hubungi panitia/guru pendamping.</p><a class="btn ghost" href="papan.html">Papan skor</a></div>${kontakHtml()}${tombolKeluar()}`;
    pasangKeluar();
  } else if (nama === 'terkunci') {
    app.innerHTML = `<div class="card center"><div class="big">${ikon('stop')}</div><h2>Nama ini sudah dipakai</h2><p class="mut">Data ini sudah digunakan mengerjakan di perangkat lain. Jika kamu berbeda dengan teman yang bernama sama, tambahkan nama belakang/inisial. Selain itu hubungi pengawas/panitia.</p><button class="btn" id="bUlang">Coba lagi</button></div>${kontakHtml()}${tombolKeluar('Ganti data')}`;
    pasangKeluar();
    $('#bUlang').onclick = () => { dimuat = false; route(); };
  } else if (nama === 'loginbeda') {
    app.innerHTML = `<div class="card center"><div class="big">${ikon('stop')}</div><h2>Akun ini sedang dipakai di perangkat lain</h2><p class="mut">${esc(st.nama)} sudah masuk di perangkat lain. Satu peserta hanya boleh memakai satu perangkat. Jika perangkat ini yang seharusnya dipakai, minta pengawas/panitia untuk mereset login, lalu tekan "Coba lagi".</p><button class="btn" id="bUlang">Coba lagi</button></div>${tombolKeluar('Ganti data')}`;
    pasangKeluar(); $('#bUlang').onclick = () => route();
  } else if (nama === 'loginerr') {
    app.innerHTML = `<div class="card center"><div class="big">${ikon('alat')}</div><h3>Belum bisa memeriksa login</h3><p class="mut">${esc(galatLogin || 'koneksi bermasalah')}. Periksa sinyal, lalu coba lagi.</p><button class="btn" id="bUlang">Coba lagi</button></div>${tombolKeluar('Ganti data')}`;
    pasangKeluar(); $('#bUlang').onclick = () => route();
  } else if (nama === 'tanpasoal') {
    app.innerHTML = `<div class="card center"><div class="big">${ikon('alat')}</div><h3>Soal untuk kelas ${esc(st.kelas)} belum disiapkan panitia.</h3></div>${tombolKeluar()}`; pasangKeluar();
  } else if (nama === 'tidaklolos') {
    app.innerHTML = `<div class="card center"><div class="big">${ikon('info')}</div><h2>Babak final khusus finalis</h2><p class="mut">${esc(st.nama)} belum terdaftar sebagai finalis. Terima kasih sudah berpartisipasi!</p>
      <button class="btn ghost" id="bCek">Cek lagi</button></div>${tombolKeluar()}`;
    $('#bCek').onclick = async () => { try { const d = await ambilPeserta(st.kode); if (d) { st.finalis = !!d.finalis; if (st.finalis) st.sesi = ''; simpan(); } } catch (e) { toast('Gagal terhubung'); } route(); };
    pasangKeluar();
  }
}
const identitasHtml = () => `<p class="mut" style="margin:0">Peserta</p><h2 style="margin:0">${esc(st.nama)}</h2><p class="mut" style="margin:2px 0">Kelas ${esc(st.kelas)} · ${esc(st.sekolah)}<br>Kec. ${esc(st.kec)}</p>`;
const babakNama = () => ({ final: 'Babak Final', gladi: 'Gladi Resik' }[cfg.babak] || 'Babak Penyisihan');
const durasiTeks = () => cfg.timer === 'soal' ? `${cfg.detikPerSoal || 30} detik per soal` : `${cfg.durasiMenit || 60} menit`;
const aturanHtml = () => `<div class="card"><b>Tata tertib</b><ul class="mut" style="padding-left:18px;margin:8px 0 0">
  <li>Kerjakan sendiri, tanpa bantuan.</li>
  ${cfg.timer === 'soal' ? '<li>Jawaban terkunci begitu dipilih. Setiap soal punya batas waktu; jika habis, soal dianggap kosong dan otomatis lanjut.</li>' : '<li>Jawaban boleh diganti sebelum kamu menekan “Selesai & kumpulkan”. Soal boleh dikerjakan tidak berurutan lewat nomor soal.</li>'}
  ${batasKeluar() ? `<li><b>Jangan keluar dari aplikasi.</b> Jika keluar ${batasKeluar()} kali, ujian berakhir otomatis dan jawaban yang sudah terisi langsung dikumpulkan.</li>` : '<li>Jangan keluar dari aplikasi — panitia dapat melihat jumlah keluar-aplikasi.</li>'}
  <li>Ada kendala sinyal atau HP mati? Segera lapor ke panitia/pengawas agar diberi toleransi.</li>
  <li>Jika aplikasi tertutup atau sinyal hilang, buka lagi di HP yang sama: jawaban tidak hilang.</li>
  <li>Saat waktu habis, jawaban dikirim otomatis.</li></ul></div>`;
const tombolKeluar = (label = 'Bukan saya / ganti data') => `<p class="center"><button class="btn ghost sm" id="bKeluar">${label}</button></p>`;
function pasangKeluar() { const b = $('#bKeluar'); if (b) b.onclick = () => { st = { dev: DEV }; simpan(); resetLokal(); route(); }; }

// ---------- Mengerjakan ----------
async function klaim() {
  const ref = fs.collection('klaim').doc(cfg.sesi + '_' + st.kode);
  try { await ref.set({ dev: DEV, at: SERVER_TS }); return true; }
  catch (e) {
    const s = await ref.get({ source: 'server' }).catch(() => null);
    if (s && s.exists) return s.data().dev === DEV;
    throw e;
  }
}
// Panitia memberi kesempatan lagi = menghapus dokumen jawaban peserta. Jawaban terisi & waktu awal tetap dipakai.
async function cekIzin() {
  const msg = $('#izinMsg'), b = $('#bIzin'); if (b) b.disabled = true; if (msg) msg.textContent = 'Memeriksa…';
  try {
    const s = await denganWaktu(fs.collection('jawaban').doc(st.sesi + '_' + st.kode).get({ source: 'server' }), 15000);
    if (s.exists) { if (msg) msg.textContent = 'Belum ada izin dari panitia.'; if (b) b.disabled = false; return; }
    if (cfg.status === 'selesai' || nowServer() >= batasPeserta(cfg, st.mulai)) { if (msg) msg.textContent = 'Waktu mengerjakan sudah habis.'; if (b) b.disabled = false; return; }
    $$('.ovl').forEach(x => x.remove());
    st.terkirim = false; st.kirim = false; st.henti = false; st.dasarKeluar = st.keluar || 0; st.pergi = 0; delete st.hasil; simpan();
    dimuat = false; mengirim = false; route();
  } catch (e) { if (msg) msg.textContent = 'Gagal terhubung: ' + e.message; if (b) b.disabled = false; }
}
async function mulaiKerja() {
  if (dimuat) return; dimuat = true; layar = 'memuat';
  const pesan = t => { app.innerHTML = `<div class="card center mut"><div class="big">${ikon('jam')}</div>${t}</div>`; };
  pesan('Menyiapkan soal…');
  try {
    if (!st.mulai) {
      if (cfg.babak === 'final' && st.finalis && !(await kunciLogin(cfg.sesi))) { // kunci login sudah pindah ke perangkat lain (mis. direset panitia)
        dimuat = false; st.sesi = ''; st.kunci = ''; kunciCek = ''; simpan(); return tampil('loginbeda');
      }
      // Sudah pernah mengirim jawaban (mis. setelah ganti kode di HP yang sama)? Jangan mulai ulang.
      if (!(await denganWaktu(klaim(), 20000))) { // kode sudah diklaim HP lain: bila jawabannya sudah masuk → tampilkan "selesai", bila belum → terkunci
        const sdh = await denganWaktu(fs.collection('jawaban').doc(cfg.sesi + '_' + st.kode).get({ source: 'server' }), 20000);
        if (sdh.exists) { st.terkirim = true; simpan(); dimuat = false; return route(); }
        dimuat = false; return tampil('terkunci');
      }
    }
    const pid = (cfg.paketKelas || {})[st.kelas];
    if (!pid) { dimuat = false; return tampil('tanpasoal'); }
    if (st.paketId === pid && st.paket) paket = st.paket;
    else {
      if (cfg.jadwal === 'serentak') await new Promise(r => setTimeout(r, Math.random() * 2500)); // sebar beban
      paket = await ambilPaket(pid);
      st.paketId = pid; st.paket = paket; simpan();
    }
    paket.soal.forEach(q => { q.o = (q.o || []).map(normOpsi); });
    const urls = []; paket.soal.forEach(q => { if (urlAman(q.g)) urls.push(q.g); q.o.forEach(o => { if (urlAman(o.g)) urls.push(o.g); }); });
    const httpUrls = [...new Set(urls.filter(u => u.startsWith('http')))];
    if (httpUrls.length) { pesan(`Memuat gambar soal… <span id="gp">0/${httpUrls.length}</span>`); await prefetchGambar(httpUrls, n => { const e = $('#gp'); if (e) e.textContent = `${n}/${httpUrls.length}`; }); }

    const ids = paket.soal.map(q => q.id);
    urutan = cfg.acakSoal ? seededShuffle(ids, st.kode + '|' + cfg.sesi) : ids;
    paket.soal.forEach(q => { const base = q.o.map((_, i) => i); opsiMap[q.id] = cfg.acakOpsi ? seededShuffle(base, st.kode + '|' + q.id) : base; });
    if (cfg.timer === 'soal' && urutan.every(id => st.jaw[id] !== undefined)) return selesaikan(false);
    if (!st.mulai) { st.mulai = Math.round(nowServer()); st.idx = Math.max(0, urutan.findIndex(id => st.jaw[id] === undefined)); st.soalMulai = nowServer(); }
    else if (!(st.idx >= 0 && st.idx < urutan.length) || (cfg.timer === 'soal' && st.jaw[urutan[st.idx]] !== undefined)) { st.idx = Math.max(0, urutan.findIndex(id => st.jaw[id] === undefined)); st.soalMulai = nowServer(); }
    simpan();
    layar = 'kerja'; document.body.classList.add('ujian'); renderSoal();
    clearInterval(timerInt); timerInt = setInterval(tick, 250);
    catatKembali(); // aplikasi sempat ditutup/ditinggalkan lalu dibuka lagi
  } catch (e) {
    dimuat = false; layar = 'galat'; document.body.classList.remove('ujian');
    app.innerHTML = `<div class="card center">Gagal memuat soal (${esc(e.message)}).<br><br><button class="btn" id="ulang">Coba lagi</button></div>`;
    $('#ulang').onclick = () => route();
  }
}
async function ambilPaket(id) {
  for (let i = 0; ; i++) {
    try {
      const s = await denganWaktu(fs.collection('paket').doc(id).get({ source: 'server' }), 20000);
      if (!s.exists) throw new Error('paket soal tidak ditemukan');
      return s.data();
    } catch (e) {
      if (i >= 4 || /tidak ditemukan|permission/i.test(e.message)) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1) + Math.random() * 2000));
    }
  }
}
function prefetchGambar(urls, onProg) {
  let n = 0;
  return Promise.race([
    Promise.all(urls.map(u => new Promise(r => { const im = new Image(); im.onload = im.onerror = () => { onProg(++n); r(); }; im.src = u; }))),
    new Promise(r => setTimeout(r, 30000))
  ]);
}

const tabelHtml = tb => !Array.isArray(tb) || !tb.length ? '' : `<div class="tbl-soal"><table>${tb.map((r, i) => `<tr>${String(r).split('|').map(c => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>`;
const gambarTag = (u, cls, alt) => urlAman(u) ? `<img ${cls ? `class="${cls}" ` : ''}src="${esc(u)}" alt="${esc(alt)}" decoding="async">` : '';
function renderSoal() {
  const id = urutan[st.idx], q = paket.soal.find(x => x.id === id), n = urutan.length;
  const dijawab = urutan.filter(x => st.jaw[x] !== undefined).length;
  const sudah = st.jaw[id];
  const modeBebas = cfg.timer !== 'soal';
  app.innerHTML = `
    <div class="bar"><span class="pill">Soal ${st.idx + 1} / ${n}</span><span class="timer" id="tmr">--:--</span></div>
    <div class="progress"><i style="width:${(dijawab / n) * 100}%"></i></div>
    <div class="card">
      ${q.t ? `<div class="qtext">${String(q.t).split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}</div>` : ''}${tabelHtml(q.tb)}${gambarTag(q.g, 'qimg', 'Gambar soal')}
      ${opsiMap[id].map((orig, pos) => { const o = q.o[orig]; return `<button class="opt ${sudah === orig ? 'dipilih' : ''}" data-o="${orig}" ${sudah !== undefined && !modeBebas ? 'disabled' : ''}><b>${HURUF[pos]}</b><span class="isi">${o.t ? `<span>${esc(o.t)}</span>` : ''}${gambarTag(o.g, '', 'Pilihan ' + HURUF[pos])}</span></button>`; }).join('')}
      ${sudah !== undefined && !modeBebas ? `<p class="mut center">${sudah === -1 ? 'Waktu soal ini habis.' : 'Jawaban sudah terkunci.'}</p>` : ''}
    </div>
    ${modeBebas ? `<div class="card"><div class="row"><button class="btn ghost" id="prev">‹ Sebelumnya</button><button class="btn ghost" id="next">Berikutnya ›</button></div>
      <div class="grid">${urutan.map((x, i) => `<button data-i="${i}" class="${st.jaw[x] !== undefined ? 'done' : ''} ${i === st.idx ? 'now' : ''}">${i + 1}</button>`).join('')}</div>
      <button class="btn dark block" id="kumpul" style="margin-top:12px">Selesai & kumpulkan (${dijawab}/${n})</button></div>` : ''}`;
  $$('.opt', app).forEach(b => b.onclick = () => pilih(id, +b.dataset.o));
  if (modeBebas) {
    const ke = i => { st.idx = i; simpan(); renderSoal(); };
    $('#prev').onclick = () => ke((st.idx - 1 + n) % n);
    $('#next').onclick = () => ke((st.idx + 1) % n);
    $$('.grid button', app).forEach(b => b.onclick = () => ke(+b.dataset.i));
    $('#kumpul').onclick = () => {
      const kosong = n - urutan.filter(x => st.jaw[x] !== undefined).length; // hitung ulang saat diklik (bukan nilai lama saat render)
      if (confirm(kosong ? `Masih ada ${kosong} soal belum dijawab. Tetap kumpulkan?` : 'Kumpulkan jawaban sekarang?')) selesaikan(false);
    };
  }
  tick();
}
function pilih(id, orig) {
  if (layar !== 'kerja') return;
  if (cfg.timer !== 'soal') { // mode total waktu: jawaban boleh diganti sampai dikumpulkan
    st.jaw[id] = orig; simpan();
    $$('.opt', app).forEach(b => b.classList.toggle('dipilih', +b.dataset.o === orig));
    const dj = urutan.filter(x => st.jaw[x] !== undefined).length, n = urutan.length;
    const pr = $('.progress i', app); if (pr) pr.style.width = (dj / n) * 100 + '%';
    const g = $$('.grid button', app)[st.idx]; if (g) g.classList.add('done');
    const kb = $('#kumpul'); if (kb) kb.textContent = `Selesai & kumpulkan (${dj}/${n})`;
    return;
  }
  if (sibuk || st.jaw[id] !== undefined) return;
  sibuk = true; st.jaw[id] = orig; simpan();
  $$('.opt', app).forEach(b => { b.disabled = true; if (+b.dataset.o === orig) b.classList.add('dipilih'); });
  setTimeout(() => { sibuk = false; lanjut(); }, 300);
}
function lanjut() {
  if (layar !== 'kerja') return;
  const n = urutan.length;
  if (cfg.timer === 'soal') {
    let i = st.idx; while (i < n && st.jaw[urutan[i]] !== undefined) i++;
    if (i >= n) return selesaikan(false);
    st.idx = i; st.soalMulai = nowServer(); simpan(); return renderSoal();
  }
  for (let s = 1; s <= n; s++) { const j = (st.idx + s) % n; if (st.jaw[urutan[j]] === undefined) { st.idx = j; simpan(); return renderSoal(); } }
  selesaikan(false);
}
function tick() {
  if (layar !== 'kerja') return;
  const total = batasPeserta(cfg, st.mulai) - nowServer();
  if (total <= 0) return selesaikan(true);
  let tampilMs = total;
  if (cfg.timer === 'soal') {
    const sisaSoal = (st.soalMulai || nowServer()) + (cfg.detikPerSoal || 30) * 1000 - nowServer();
    tampilMs = Math.min(sisaSoal, total);
    const id = urutan[st.idx];
    if (sisaSoal <= 0 && !sibuk && st.jaw[id] === undefined) { st.jaw[id] = -1; simpan(); return lanjut(); }
  }
  const el = $('#tmr'); if (el) { el.textContent = fmtTime(tampilMs); el.classList.toggle('warn', tampilMs < 10000); }
}

// ---------- Kirim ----------
function selesaikan(otomatis) {
  clearInterval(timerInt); timerInt = null;
  if (!st.kirim && !st.terkirim) { st.kirim = true; st.selesaiLokal = Math.round(nowServer()); simpan(); }
  kirim(otomatis && cfg.jadwal === 'serentak');
}
async function kirim(denganJeda) {
  if (mengirim || st.terkirim) return; mengirim = true; layar = 'kirim'; st.pergi = 0; document.body.classList.remove('ujian'); clearInterval(timerInt);
  const n = Object.values(st.jaw).filter(v => v !== -1).length;
  app.innerHTML = `<div class="card center"><div class="big">${ikon('kirim')}</div><h3>Mengirim jawaban…</h3><p class="mut">${n} jawaban. Jangan tutup aplikasi.</p><p class="mut" id="kirimInfo"></p></div>`;
  if (denganJeda) await new Promise(r => setTimeout(r, Math.random() * 15000)); // sebar kiriman serentak
  const ref = fs.collection('jawaban').doc(st.sesi + '_' + st.kode);
  const data = { sesi: st.sesi, kode: st.kode, n: st.nama, kc: st.kec, s: st.sekolah, k: st.kelas, jaw: st.jaw, keluar: st.keluar || 0, mulai: Math.round(st.mulai || 0), kirimAt: SERVER_TS };
  for (let i = 0; ; i++) {
    try {
      await denganWaktu(ref.set(data), 25000);
      break;
    } catch (e) {
      if (/permission/i.test(e.code || e.message)) {
        const ada = await ref.get().then(s => s.exists).catch(() => false); // dokumen hanya boleh dibuat sekali
        if (ada) break;
      }
      const info = $('#kirimInfo'); if (info) info.textContent = `Belum terkirim (${e.message}). Mencoba lagi otomatis…`;
      await new Promise(r => setTimeout(r, Math.min(30000, 2000 * (i + 1)) + Math.random() * 3000));
    }
  }
  st.hasil = hitungLokal(); st.terkirim = true; st.kirim = false; delete st.paket; simpan();
  mengirim = false; resetLokal(); tampil('selesai');
}

// Skor lokal (hanya bila panitia mengaktifkan "tampilkan skor ke peserta", mis. saat gladi; paket membawa kunci)
function hitungLokal() {
  const p = paket || st.paket; if (!cfg.tampilSkor || !p || !p.kunci) return null;
  let benar = 0, salah = 0; const n = (p.soal || []).length;
  Object.entries(st.jaw).forEach(([id, v]) => { if (v === -1 || p.kunci[id] === undefined) return; if (v === p.kunci[id]) benar++; else salah++; });
  const dur = Math.max(0, Math.min((st.selesaiLokal || Math.round(nowServer())) - (st.mulai || 0), cfg.durasiTotalMs || Infinity));
  return { benar, salah, kosong: n - benar - salah, skor: benar * (cfg.poinBenar ?? 2) + salah * (cfg.poinSalah ?? 0), durasiMs: dur, n };
}
const hasilHtml = () => st.hasil ? `<div class="skor"><div class="stats"><div class="stat"><b>${st.hasil.skor}</b><span>Skor</span></div><div class="stat"><b>${st.hasil.benar}</b><span>Benar</span></div><div class="stat"><b>${st.hasil.salah}</b><span>Salah</span></div><div class="stat"><b>${st.hasil.kosong}</b><span>Kosong</span></div><div class="stat"><b>${fmtTime(st.hasil.durasiMs)}</b><span>Waktu</span></div></div></div>` : '';
// Keluar aplikasi: dicatat saat kembali (>= 2 detik). Mencapai batas → jawaban otomatis dikumpulkan.
function peringatan(html) {
  $$('.ovl').forEach(x => x.remove());
  const o = document.createElement('div'); o.className = 'ovl';
  o.innerHTML = `<div class="card center"><div class="big">${ikon('stop')}</div>${html}<button class="btn block" style="margin-top:14px">Mengerti</button></div>`;
  o.querySelector('button').onclick = () => o.remove(); document.body.appendChild(o);
}
function catatKembali() {
  if (!st.pergi) return;
  const lama = Date.now() - st.pergi; st.pergi = 0;
  if (layar !== 'kerja' || lama < JEDA_KELUAR) { simpan(); return; }
  st.keluar = (st.keluar || 0) + 1;
  const batas = batasKeluar(), pakai = st.keluar - (st.dasarKeluar || 0);
  if (batas > 0 && pakai >= batas) {
    st.henti = true; simpan();
    peringatan(`<h3>Ujian berakhir otomatis</h3><p class="mut">Kamu sudah keluar dari aplikasi ${pakai} kali. Jawaban yang sudah terisi dikumpulkan sekarang.</p>`);
    return selesaikan(false);
  }
  simpan();
  if (batas > 0) peringatan(`<h3>Kamu keluar dari aplikasi</h3><p class="mut">Tercatat <b>${pakai} dari ${batas}</b> kali. Jika mencapai ${batas} kali, ujian berakhir otomatis dan jawaban langsung dikumpulkan.</p>`);
}
// Saat ujian: blok teks / salin / menu tekan-lama dimatikan (cegah "cari di Google" atau Google Lens dari soal)
const lagiUjian = () => document.body.classList.contains('ujian');
['contextmenu', 'selectstart', 'copy', 'cut', 'dragstart'].forEach(ev => document.addEventListener(ev, e => { if (lagiUjian()) e.preventDefault(); }, true));
document.addEventListener('selectionchange', () => { if (lagiUjian()) { const s = window.getSelection && window.getSelection(); if (s && !s.isCollapsed) s.removeAllRanges(); } });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (layar === 'kerja' && !st.pergi) { st.pergi = Date.now(); simpan(); } }
  else catatKembali();
});
