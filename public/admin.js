let cfg = {}, bank = [], hasil = [], papanTerakhir = '', unsubJawab = null, sesiDidengar = null;
let tickInt = null, papanInt = null, sudahPasang = false;
const docBank = fs.collection('admin').doc('bank');
const GRACE_MS = 5 * 60000; // toleransi kiriman terlambat (sinyal lemot / antre)
const DEFAULT_CFG = { judul: DEFAULT_JUDUL, mode: 'lomba', durasiMenit: 30, detikPerSoal: 30, poinBenar: 10, poinSalah: 0, acakSoal: true, acakOpsi: true, status: 'menunggu', jumlahSoal: 0 };

const base = location.href.replace(/[^/]*$/, '');
$('#lPeserta').href = $('#lPeserta').textContent = base;
$('#lPapan').href = $('#lPapan').textContent = $('#lPapan2').href = base + 'papan.html';

// ---------- Login ----------
$('#fLogin').onsubmit = e => {
  e.preventDefault(); const f = e.target.elements;
  $('#loginMsg').textContent = 'Memproses…';
  firebase.auth().signInWithEmailAndPassword(f.email.value, f.pass.value).catch(err => $('#loginMsg').textContent = 'Gagal: ' + err.message);
};
$('#bLogout').onclick = () => firebase.auth().signOut().then(() => location.reload());

firebase.auth().onAuthStateChanged(async u => {
  if (!u) { $('#vLogin').classList.remove('hide'); $('#vAdmin').classList.add('hide'); return; }
  const ok = await fs.collection('admins').doc(u.uid).get().then(s => s.exists).catch(() => false);
  if (!ok) {
    $('#vLogin').classList.remove('hide');
    $('#loginMsg').innerHTML = `Akun ini belum terdaftar sebagai admin.<br>Di Firestore buat dokumen <code>admins/${esc(u.uid)}</code> (isi bebas, mis. aktif = true).<br><button class="btn ghost sm" id="bOut">Keluar</button>`;
    $('#bOut').onclick = () => firebase.auth().signOut();
    return;
  }
  $('#vLogin').classList.add('hide'); $('#vAdmin').classList.remove('hide');
  pasangListener();
});

// ---------- Tab ----------
$$('.tabs button').forEach(b => b.onclick = () => {
  $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  ['kontrol', 'soal', 'hasil'].forEach(t => $('#t' + t[0].toUpperCase() + t.slice(1)).classList.toggle('hide', t !== b.dataset.t));
});

// ---------- Listener ----------
function pasangListener() {
  if (sudahPasang) return; sudahPasang = true;
  docConfig.onSnapshot(s => {
    if (!s.exists) { docConfig.set({ ...DEFAULT_CFG, sesi: acakId(8) }); return; }
    cfg = { ...DEFAULT_CFG, ...s.data() };
    $('#judul').textContent = cfg.judul;
    isiFormCfg(); renderStatus(); dengarJawaban(); hitung();
  });
  docBank.onSnapshot(s => {
    bank = (s.data() || {}).soal || [];
    renderSoal(); hitung();
    if (cfg.status === 'menunggu' && cfg.jumlahSoal !== bank.length && cfg.sesi) docConfig.update({ jumlahSoal: bank.length });
  });
  clearInterval(tickInt); tickInt = setInterval(renderTimer, 500);
  clearInterval(papanInt); papanInt = setInterval(kirimPapan, 5000);
}

// Hanya kiriman sesi aktif yang dibaca (sesi lama diabaikan, tidak perlu dihapus)
function dengarJawaban() {
  if (!cfg.sesi || sesiDidengar === cfg.sesi) return;
  sesiDidengar = cfg.sesi; if (unsubJawab) unsubJawab();
  hasil = []; renderHasil();
  unsubJawab = fs.collection('jawaban').where('sesi', '==', cfg.sesi).onSnapshot(qs => {
    hasil = qs.docs.map(d => ({ id: d.id, ...d.data() })); hitung();
  }, err => toast('Gagal membaca jawaban: ' + err.message));
}

// ---------- Kontrol ----------
function isiFormCfg() {
  if ($('#fCfg').contains(document.activeElement)) return;
  const f = $('#fCfg').elements;
  ['judul', 'mode', 'durasiMenit', 'detikPerSoal', 'poinBenar', 'poinSalah'].forEach(k => f[k].value = cfg[k]);
  f.acakSoal.checked = !!cfg.acakSoal; f.acakOpsi.checked = !!cfg.acakOpsi;
}
$('#fCfg').onsubmit = e => {
  e.preventDefault(); const f = e.target.elements;
  if (cfg.status === 'mulai') return toast('Tidak bisa mengubah pengaturan saat lomba berjalan.');
  docConfig.update({
    judul: f.judul.value.trim() || DEFAULT_JUDUL, mode: f.mode.value,
    durasiMenit: Math.max(1, +f.durasiMenit.value || 30), detikPerSoal: Math.max(5, +f.detikPerSoal.value || 30),
    poinBenar: +f.poinBenar.value || 0, poinSalah: +f.poinSalah.value || 0,
    acakSoal: f.acakSoal.checked, acakOpsi: f.acakOpsi.checked
  }).then(() => { document.activeElement.blur(); toast('Pengaturan disimpan'); });
};
const totalMs = () => cfg.mode === 'soal' ? (cfg.detikPerSoal || 30) * 1000 * bank.length : (cfg.durasiMenit || 30) * 60000;
function renderStatus() {
  const st = cfg.status || 'menunggu';
  const p = $('#stPill'); p.className = 'pill ' + st; p.textContent = { menunggu: 'Menunggu', mulai: 'Berlangsung', selesai: 'Selesai' }[st];
  $('#bMulai').disabled = st !== 'menunggu'; $('#bAkhiri').disabled = st !== 'mulai';
  const mode = cfg.mode === 'soal' ? `${cfg.detikPerSoal} detik/soal` : `${cfg.durasiMenit} menit`;
  $('#stInfo').textContent = `${bank.length} soal · ${mode} · sesi ${cfg.sesi || '-'}` + (cfg.mulaiAt && st !== 'menunggu' ? ` · dimulai ${fmtJam(tsMs(cfg.mulaiAt))}` : '');
}
function renderTimer() {
  const el = $('#stTimer');
  if (cfg.status === 'mulai') {
    const sisa = sisaWaktu(cfg); el.textContent = fmtTime(sisa);
    if (sisa < -5000 && tsMs(cfg.mulaiAt)) { cfg.status = 'selesai'; docConfig.update({ status: 'selesai' }); } // tutup otomatis
  } else el.textContent = cfg.status === 'selesai' ? 'SELESAI' : fmtTime(totalMs());
}
$('#bMulai').onclick = async () => {
  if (!bank.length) return toast('Belum ada soal.');
  if (bank.some(q => !(q.k >= 0 && q.k <= 3))) return toast('Ada soal tanpa kunci jawaban.');
  if (!confirm(`Mulai lomba sekarang? (${bank.length} soal)\nSoal langsung tampil di HP semua peserta.`)) return;
  const paketId = acakId(24); // ID acak: soal tidak bisa diintip sebelum lomba dimulai
  try {
    await fs.collection('paket').doc(paketId).set({ soal: bank.map(q => ({ id: q.id, t: q.t, o: q.o })) });
    await docConfig.update({ status: 'mulai', mulaiAt: SERVER_TS, durasiTotalMs: totalMs(), jumlahSoal: bank.length, paketId });
  } catch (e) { toast('Gagal memulai: ' + e.message); }
};
$('#bAkhiri').onclick = () => { if (confirm('Akhiri lomba sekarang? Peserta yang masih mengerjakan langsung mengirim jawabannya.')) docConfig.update({ status: 'selesai' }); };
$('#bReset').onclick = async () => {
  if (cfg.status === 'mulai') return toast('Akhiri lomba dulu sebelum reset.');
  if (prompt('Ketik RESET untuk memulai sesi lomba baru (hasil sesi ini tidak tampil lagi — unduh CSV dulu bila perlu):') !== 'RESET') return;
  const sesi = acakId(8);
  await docConfig.update({ status: 'menunggu', mulaiAt: null, paketId: null, sesi, jumlahSoal: bank.length });
  await docPapan.set({ sesi, total: 0, top: [], update: SERVER_TS });
  papanTerakhir = ''; toast('Sesi baru siap');
};

// ---------- Bank soal (dokumen admin/bank, hanya admin yang bisa baca) ----------
$('#fsOpsi').innerHTML = HURUF.map((h, i) => `<label>Opsi ${h}</label><input name="o${i}" required>`).join('');
let editId = null;
function bukaForm(id) {
  editId = id || null; $('#fSoal').reset(); const f = $('#fSoal').elements;
  $('#fsJudul').textContent = id ? 'Edit soal' : 'Tambah soal';
  if (id) { const q = bank.find(x => x.id === id); f.t.value = q.t; q.o.forEach((o, i) => f['o' + i].value = o); f.k.value = q.k; }
  $('#formSoal').classList.remove('hide'); $('#formSoal').scrollIntoView({ behavior: 'smooth' }); f.t.focus();
}
const bolehUbah = () => { if (cfg.status === 'mulai') { toast('Lomba sedang berjalan, soal tidak bisa diubah.'); return false; } return true; };
const simpanBank = list => docBank.set({ soal: list }).catch(err => { toast('Gagal: ' + err.message); throw err; });
const idBaru = () => 's' + Date.now().toString(36) + acakId(4);
$('#bTambah').onclick = () => bukaForm();
$('#bBatal').onclick = () => $('#formSoal').classList.add('hide');
$('#fSoal').onsubmit = e => {
  e.preventDefault(); if (!bolehUbah()) return; const f = e.target.elements;
  const q = { id: editId || idBaru(), t: f.t.value.trim(), o: [0, 1, 2, 3].map(i => f['o' + i].value.trim()), k: +f.k.value };
  const list = editId ? bank.map(x => x.id === editId ? q : x) : [...bank, q];
  simpanBank(list).then(() => { $('#formSoal').classList.add('hide'); toast('Soal disimpan'); });
};
const dariDaftar = list => list.map((s, i) => ({ id: 's' + String(i + 1).padStart(3, '0') + acakId(3), t: s.t, o: s.o, k: s.k }));
$('#bContoh').onclick = () => {
  if (!bolehUbah() || (bank.length && !confirm('Ganti semua soal yang ada dengan 30 soal contoh?'))) return;
  simpanBank(dariDaftar(SOAL_CONTOH)).then(() => toast('30 soal contoh dimuat'));
};
$('#bHapusSoal').onclick = () => { if (bolehUbah() && confirm('Hapus SEMUA soal?')) simpanBank([]); };
$('#bEksporSoal').onclick = () => unduh('soal-olimpiade-literasi-numerasi.json', JSON.stringify(bank.map(({ t, o, k }) => ({ t, o, k })), null, 2), 'application/json');
$('#fileImpor').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file || !bolehUbah()) return;
  try {
    const teks = await file.text(); let list;
    if (/\.json$/i.test(file.name) || teks.trim().startsWith('[')) {
      list = JSON.parse(teks).map(x => { const k = x.k ?? x.kunci; return { t: x.t ?? x.soal, o: x.o ?? x.opsi, k: typeof k === 'string' && isNaN(k) ? HURUF.indexOf(k.trim().toUpperCase()) : +k }; });
    } else {
      const rows = parseCSV(teks.replace(/^﻿/, '')).filter(r => r.some(c => c.trim()));
      if (rows.length && /soal|pertanyaan/i.test(rows[0][0])) rows.shift();
      list = rows.map(r => ({ t: r[0], o: [r[1], r[2], r[3], r[4]], k: HURUF.indexOf(String(r[5] || '').trim().toUpperCase()) }));
    }
    const salah = list.findIndex(s => !String(s.t ?? '').trim() || !Array.isArray(s.o) || s.o.length !== 4 || s.o.some(o => !String(o ?? '').trim()) || !(s.k >= 0 && s.k <= 3));
    if (salah >= 0) return toast(`Format salah di soal ke-${salah + 1}`);
    list = list.map(s => ({ t: String(s.t).trim(), o: s.o.map(o => String(o).trim()), k: s.k }));
    const ganti = bank.length ? confirm(`Impor ${list.length} soal.\nOK = ganti semua soal lama\nBatal = tambahkan ke soal lama`) : true;
    const baru = dariDaftar(list);
    simpanBank(ganti ? baru : [...bank, ...baru]).then(() => toast(`${list.length} soal diimpor`));
  } catch (err) { toast('Gagal membaca file: ' + err.message); }
};
function parseCSV(str) {
  const l1 = str.split('\n')[0];
  const sep = (l1.match(/;/g) || []).length > (l1.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (q) { if (c === '"') { if (str[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && str[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function renderSoal() {
  $('#jmlSoal').textContent = `(${bank.length})`;
  $('#daftarSoal').innerHTML = !bank.length ? '<div class="card center mut">Belum ada soal. Klik “Muat 30 soal contoh” atau tambah manual.</div>' :
    `<div class="card"><p class="mut" style="margin-top:0">${bank.length} soal${bank.length !== 30 ? ' (target 30)' : ''}</p>` + bank.map((q, i) => `
    <div class="soal-item"><b>${i + 1}. ${esc(q.t)}</b>
      <ol type="A">${q.o.map((o, j) => `<li class="${q.k === j ? 'k' : ''}">${esc(o)}${q.k === j ? ' ✓' : ''}</li>`).join('')}</ol>
      <div class="row" style="justify-content:flex-start"><button class="btn ghost sm" style="flex:0" data-e="${q.id}">Edit</button><button class="btn ghost sm" style="flex:0" data-h="${q.id}">Hapus</button></div>
    </div>`).join('') + '</div>';
  $$('[data-e]').forEach(b => b.onclick = () => bukaForm(b.dataset.e));
  $$('[data-h]').forEach(b => b.onclick = () => { if (bolehUbah() && confirm('Hapus soal ini?')) simpanBank(bank.filter(q => q.id !== b.dataset.h)); });
  renderStatus();
}

// ---------- Penilaian (di perangkat admin; kunci tidak pernah dikirim ke HP peserta) ----------
let skor = [];
function hitung() {
  const kunci = Object.fromEntries(bank.map(q => [q.id, q.k]));
  const n = cfg.jumlahSoal || bank.length;
  const mulai = tsMs(cfg.mulaiAt), batas = mulai + (cfg.durasiTotalMs || 0) + GRACE_MS;
  skor = hasil.map(h => {
    let benar = 0, salah = 0;
    Object.entries(h.jaw || {}).forEach(([sid, v]) => { if (v === -1 || kunci[sid] === undefined) return; if (v === kunci[sid]) benar++; else salah++; });
    const kirim = tsMs(h.kirimAt);
    return {
      id: h.id, nama: String(h.nama || '-').slice(0, 60), asal: String(h.asal || '').slice(0, 80), benar, salah,
      kosong: Math.max(0, n - benar - salah), dijawab: benar + salah, total: n,
      skor: benar * (cfg.poinBenar ?? 10) + salah * (cfg.poinSalah ?? 0),
      durasiMs: mulai && kirim ? Math.min(Math.max(0, kirim - mulai), cfg.durasiTotalMs || Infinity) : null,
      kirimAt: kirim, keluar: +h.keluar || 0, telat: !!(mulai && kirim && kirim > batas)
    };
  });
  urutkanSkor(skor);
  skor.sort((a, b) => a.telat - b.telat); // kiriman terlambat di bawah
  renderHasil();
}
function kirimPapan() {
  if (!cfg.sesi) return;
  const top = skor.filter(s => !s.telat).slice(0, 100).map(({ nama, asal, benar, skor, dijawab, total, durasiMs }) => ({ nama, asal, benar, skor, dijawab, total, durasiMs }));
  const isi = JSON.stringify([cfg.sesi, skor.length, top]);
  if (isi === papanTerakhir) return;
  papanTerakhir = isi;
  docPapan.set({ sesi: cfg.sesi, total: skor.length, top, update: SERVER_TS }).catch(() => { papanTerakhir = ''; });
}
function renderHasil() {
  $('#jmlPeserta').textContent = `(${skor.length})`;
  const telat = skor.filter(s => s.telat).length;
  $('#ringkas').textContent = `${skor.length} peserta sudah mengumpulkan${telat ? ` · ${telat} terlambat` : ''}. Tabel menampilkan maks. 300 baris; CSV berisi semua.`;
  const q = ($('#cari').value || '').toLowerCase();
  const rows = skor.map((s, i) => ({ ...s, rk: i + 1 })).filter(s => !q || (s.nama + ' ' + s.asal).toLowerCase().includes(q)).slice(0, 300);
  $('#tbHasil').innerHTML = !rows.length ? '<tr><td colspan="10" class="mut center">Belum ada kiriman.</td></tr>' : rows.map(s => `
    <tr><td>${s.telat ? '–' : s.rk}</td><td><b>${esc(s.nama)}</b><br><span class="mut">${esc(s.asal)}</span></td>
    <td>${s.dijawab}/${s.total}</td><td>${s.benar}</td><td>${s.salah}</td><td>${s.kosong}</td><td><b>${s.skor}</b></td>
    <td>${s.telat ? '<span class="pill selesai">terlambat</span>' : fmtTime(s.durasiMs || 0)}</td>
    <td>${s.keluar ? `<span class="pill selesai">${s.keluar}×</span>` : '0'}</td>
    <td><button class="btn ghost sm" data-del="${s.id}">Hapus</button></td></tr>`).join('');
  $$('[data-del]').forEach(b => b.onclick = () => { if (confirm('Hapus kiriman peserta ini?')) fs.collection('jawaban').doc(b.dataset.del).delete(); });
}
$('#cari').oninput = renderHasil;
$('#bEkspor').onclick = () => {
  const qq = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['Peringkat,Nama,Asal Sekolah,Dijawab,Benar,Salah,Kosong,Skor,Waktu Pengerjaan,Jam Kirim,Keluar Aplikasi,Keterangan']
    .concat(skor.map((s, i) => [s.telat ? '' : i + 1, qq(s.nama), qq(s.asal), s.dijawab, s.benar, s.salah, s.kosong, s.skor, fmtTime(s.durasiMs || 0), fmtJam(s.kirimAt), s.keluar, s.telat ? 'terlambat' : ''].join(','))).join('\n');
  unduh(`hasil-${(cfg.judul || 'lomba').replace(/\W+/g, '-').toLowerCase()}.csv`, '﻿' + csv, 'text/csv');
};
function unduh(nama, isi, tipe) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([isi], { type: tipe })); a.download = nama; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
