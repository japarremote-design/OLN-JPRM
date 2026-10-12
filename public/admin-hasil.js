// ===== Admin: hasil, papan skor, seleksi finalis =====
let sesiDipilih = null, hasilDocs = [], kirimSet = new Set(), skor = [], sesiDengar = null, unsubJawab = null;
let papanTerakhir = '', batasH = 100, hitungT = null, kuota = {};

// ---------- sesi ----------
function sesiBerubah() {
  if (!sesiDipilih || !sesiList.some(s => s.id === sesiDipilih)) sesiDipilih = (sesiList.find(s => s.id === cfg.sesi) || sesiList[0] || {}).id || null;
  renderSelSesi();
  if (sesiDengar && sesiDengar !== sesiDipilih) pastikanJawaban();
}
function renderSelSesi() {
  const opsi = sesiList.length ? sesiList.map(s => `<option value="${s.id}">${esc(s.nama || s.id)}${s.id === cfg.sesi ? ' (aktif)' : ''}</option>`).join('') : '<option value="">Belum ada sesi dibuka</option>';
  ['#selSesi', '#selSesiF'].forEach(sel => { const e = $(sel); e.innerHTML = opsi; e.value = sesiDipilih || ''; });
}
['#selSesi', '#selSesiF'].forEach(sel => $(sel).onchange = e => { sesiDipilih = e.target.value; renderSelSesi(); pastikanJawaban(); batasH = 100; hitungSkor(); });
function pastikanJawaban() {
  if (!sesiDipilih) { hasilDocs = []; hitungSkor(); return; }
  if (sesiDengar === sesiDipilih) return;
  if (unsubJawab) unsubJawab();
  sesiDengar = sesiDipilih; hasilDocs = [];
  unsubJawab = fs.collection('jawaban').where('sesi', '==', sesiDipilih).onSnapshot(qs => {
    hasilDocs = qs.docs.map(d => ({ id: d.id, ...d.data() })); jadwalHitung();
  }, err => toast('Gagal membaca jawaban: ' + err.message));
  hitungSkor();
}
function hasilDibuka() { pastikanJawaban(); renderSelSesi(); hitungSkor(); }
const jadwalHitung = () => { clearTimeout(hitungT); hitungT = setTimeout(hitungSkor, 300); };
const sesiMeta = () => sesiList.find(s => s.id === sesiDipilih);
const lihat = id => !$('#' + id).classList.contains('hide');

// ---------- penilaian (di perangkat admin; kunci tidak pernah dikirim ke HP peserta) ----------
const PREDIKAT = ['', 'Juara 1', 'Juara 2', 'Juara 3', 'Harapan 1'];
function hitungSkor() {
  const S = sesiMeta();
  if (!S) { skor = []; kirimSet = new Set(); return renderSemua(); }
  const dur = S.durasiTotalMs || 0, mulaiSesi = tsMs(S.mulaiAt);
  skor = hasilDocs.map(h => {
    const p = roster.get(h.kode) || {}; let benar = 0, salah = 0;
    const kelas = String(h.k || p.k || ''), kunci = (S.kunci || {})[kelas] || {};
    const n = (S.jumlahSoalKelas || {})[kelas] || Object.keys(kunci).length || S.jumlahSoal || 0;
    Object.entries(h.jaw || {}).forEach(([sid, v]) => { if (v === -1 || kunci[sid] === undefined) return; if (v === kunci[sid]) benar++; else salah++; });
    const kirim = tsMs(h.kirimAt), mulai = S.jadwal === 'serentak' ? mulaiSesi : (+h.mulai || 0);
    const batas = S.jadwal === 'serentak' ? mulaiSesi + dur : Math.min((+h.mulai || 0) + dur, S.tutupAt ? S.tutupAt + 600000 : Infinity);
    return {
      id: h.id, kode: h.kode, nama: h.n || p.n || '(tanpa nama)', asal: h.s || p.s || '', kec: h.kc || p.kc || '', kelas,
      benar, salah, kosong: Math.max(0, n - benar - salah), dijawab: benar + salah, total: n,
      skor: benar * (S.poinBenar ?? 2) + salah * (S.poinSalah ?? 0),
      durasiMs: mulai && kirim ? Math.min(Math.max(0, kirim - mulai), dur || Infinity) : null,
      kirimAt: kirim, keluar: +h.keluar || 0, telat: !!(kirim && batas && kirim > batas + 5 * 60000)
    };
  });
  urutkanSkor(skor); skor.sort((a, b) => a.telat - b.telat); // kiriman terlambat di bawah
  const rk = {}, rkc = {};
  skor.forEach(s => { // peringkat dihitung per kelas (soal tiap kelas berbeda)
    if (s.telat) { s.rk = 0; s.rkKec = 0; s.predikat = ''; return; }
    s.rk = rk[s.kelas] = (rk[s.kelas] || 0) + 1;
    const key = s.kec + '|' + s.kelas; s.rkKec = rkc[key] = (rkc[key] || 0) + 1; s.predikat = PREDIKAT[s.rkKec] || '';
  });
  kirimSet = new Set(skor.map(s => s.kode));
  renderSemua();
}
function renderSemua() {
  $('#jmlHasil').textContent = skor.length ? `(${skor.length})` : '';
  if (lihat('tHasil')) renderHasil();
  if (lihat('tPeserta') && rosterMuat) renderPeserta();
  if (lihat('tFinalis')) renderFinalis();
}
const terdaftarSesi = () => { const S = sesiMeta(); return rosterMuat ? [...roster.entries()].filter(([, r]) => S && S.babak === 'final' ? r.finalis : true) : []; };

// ---------- tampilan hasil ----------
function saringHasil() {
  const kc = $('#hKec').value, kl = $('#hKelas').value, q = ($('#hCari').value || '').toLowerCase().trim();
  return skor.filter(s => (!kc || s.kec === kc) && (!kl || s.kelas === kl) && (!q || (s.nama + ' ' + s.asal).toLowerCase().includes(q)));
}
function renderHasil() {
  const daftar = terdaftarSesi(), n = skor.length, ok = skor.filter(s => !s.telat);
  const rata = ok.length ? Math.round(ok.reduce((a, s) => a + s.skor, 0) / ok.length * 10) / 10 : 0;
  $('#statHasil').innerHTML = [['Terdaftar', rosterMuat ? daftar.length : '–'], ['Sudah mengerjakan', n], ['Belum', rosterMuat ? Math.max(0, daftar.length - n) : '–'], ['Skor tertinggi', ok.length ? ok[0].skor : '-'], ['Rata-rata', rata], ['Terlambat', n - ok.length]]
    .map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  const arr = saringHasil();
  $('#tbHasil').innerHTML = !arr.length ? '<tr><td colspan="10" class="mut center">Belum ada kiriman.</td></tr>' : arr.slice(0, batasH).map(s => `
    <tr><td>${s.rk || '–'}</td><td>${s.rkKec || '–'}${s.predikat ? `<br><span class="pill mulai">${s.predikat}</span>` : ''}</td><td><b>${esc(s.nama)}</b><br><span class="mut">Kls ${esc(s.kelas)} · ${esc(s.asal)} · Kec. ${esc(s.kec)}</span></td>
    <td>${s.benar}</td><td>${s.salah}</td><td>${s.kosong}</td><td><b>${s.skor}</b></td>
    <td>${s.telat ? '<span class="pill selesai">terlambat</span>' : fmtTime(s.durasiMs || 0)}</td><td>${s.keluar ? `<span class="pill selesai">${s.keluar}×</span>` : '0'}</td>
    <td><button class="btn ghost sm" data-reset="${s.kode}">Reset</button></td></tr>`).join('');
  $('#bMoreH').classList.toggle('hide', arr.length <= batasH);
  $$('#tbHasil [data-reset]').forEach(b => b.onclick = () => resetPeserta(b.dataset.reset));
  const per = rekapKec(daftar);
  $('#tbRekap').innerHTML = per.map(r => `<tr><td>${esc(r.kec)}</td><td>${rosterMuat ? r.daftar : '–'}</td><td>${r.kirim}</td><td>${r.maks ?? '-'}</td><td>${r.rata ?? '-'}</td></tr>`).join('') || '<tr><td colspan="5" class="mut center">–</td></tr>';
}
function rekapKec(daftar) {
  const m = {}, buat = kc => (m[kc] = m[kc] || { kec: kc, daftar: 0, kirim: 0, jml: 0, maks: null });
  daftar.forEach(([, r]) => { buat(r.kc).daftar++; });
  skor.filter(s => !s.telat && s.kec).forEach(s => { const x = buat(s.kec); x.kirim++; x.jml += s.skor; x.maks = x.maks === null ? s.skor : Math.max(x.maks, s.skor); });
  return Object.values(m).map(x => ({ ...x, rata: x.kirim ? Math.round(x.jml / x.kirim * 10) / 10 : null })).sort((a, b) => a.kec.localeCompare(b.kec));
}
['#hKec', '#hKelas', '#hCari'].forEach(s => $(s).addEventListener('input', () => { batasH = 100; renderHasil(); }));
$('#bMoreH').onclick = () => { batasH += 200; renderHasil(); };
$('#bEkspor').onclick = async () => {
  if (!sesiMeta()) return toast('Belum ada sesi.');
  const ok = skor, daftar = terdaftarSesi();
  const kepala = ['Peringkat Kelas', 'Peringkat Kecamatan', 'Predikat', 'Nama Siswa', 'Kelas', 'Nama Sekolah', 'Kecamatan', 'Benar', 'Salah', 'Kosong', 'Skor', 'Waktu Pengerjaan', 'Jam Kirim', 'Keluar Aplikasi', 'Keterangan'];
  const baris = s => [s.rk || '', s.rkKec || '', s.predikat || '', s.nama, +s.kelas || s.kelas, s.asal, s.kec, s.benar, s.salah, s.kosong, s.skor, s.durasiMs != null ? fmtTime(s.durasiMs) : '', fmtJam(s.kirimAt), s.keluar, s.telat ? 'terlambat' : ''];
  const sheets = { Peringkat: [kepala, ...ok.map(baris)] };
  KELAS_LOMBA.forEach(k => { sheets['Kelas ' + k] = [kepala, ...ok.filter(s => s.kelas === k).map(baris)]; });
  sheets['Juara per Kecamatan'] = [kepala, ...ok.filter(s => s.predikat).sort((a, b) => a.kec.localeCompare(b.kec) || a.kelas.localeCompare(b.kelas) || a.rkKec - b.rkKec).map(baris)];
  sheets['Per Kecamatan'] = [['Kecamatan', 'Terdaftar', 'Sudah Mengerjakan', 'Skor Tertinggi', 'Rata-rata']].concat(rekapKec(daftar).map(r => [r.kec, rosterMuat ? r.daftar : '', r.kirim, r.maks ?? '', r.rata ?? '']));
  if (rosterMuat) sheets['Belum Mengerjakan'] = [['Nama Siswa', 'Kelas', 'Nama Sekolah', 'Kecamatan']].concat(urutPeserta(daftar.filter(([k]) => !kirimSet.has(k))).map(([k, r]) => [r.n, +r.k, r.s, r.kc]));
  unduhXlsx(`hasil-${(sesiMeta().nama || 'sesi').replace(/\W+/g, '-').toLowerCase()}.xlsx`, sheets);
};

// ---------- papan skor publik (diperbarui tiap ±30 detik bila berubah) ----------
function kirimPapan() {
  if (!cfg.sesi || sesiDipilih !== cfg.sesi || sesiDengar !== cfg.sesi) return;
  const aktif = skor.filter(s => !s.telat), ring = s => ({ n: s.nama, s: s.asal, kc: s.kec, k: s.kelas, b: s.benar, sk: s.skor, d: s.durasiMs });
  const kls = {}, kec = {}, tot = {};
  if (papanTampil) {
    KELAS_LOMBA.forEach(k => { const a = aktif.filter(s => s.kelas === k); tot[k] = a.length; kls[k] = a.slice(0, 30).map(ring); });
    aktif.forEach(s => { const per = (kec[s.kec] = kec[s.kec] || {}); const a = (per[s.kelas] = per[s.kelas] || []); if (a.length < 10) a.push(ring(s)); });
  }
  const isi = JSON.stringify([cfg.sesi, cfg.babak, papanTampil, aktif.length, kls, kec]);
  if (isi === papanTerakhir) return; papanTerakhir = isi;
  docPapan.set({ sesi: cfg.sesi, babak: cfg.babak, tampil: papanTampil, total: aktif.length, tot, kls, kec, update: SERVER_TS }).catch(() => { papanTerakhir = ''; });
}
setInterval(kirimPapan, 30000);

// ---------- finalis ----------
function bagiKuota(total, n, mode) { // n: {kec: jumlah peserta}
  const k = Object.keys(n).filter(x => n[x] > 0), q = Object.fromEntries(Object.keys(n).map(x => [x, 0]));
  let sisa = total; if (!k.length) return q;
  if (total >= k.length) { k.forEach(x => q[x] = 1); sisa -= k.length; } // minimal 1 per kecamatan
  let aktif = k.filter(x => q[x] < n[x]), guard = 0;
  while (sisa > 0 && aktif.length && guard++ < 60) {
    const W = aktif.reduce((a, x) => a + (mode === 'rata' ? 1 : n[x]), 0);
    const frak = aktif.map(x => { const ideal = sisa * (mode === 'rata' ? 1 : n[x]) / W; return { x, f: Math.floor(ideal), r: ideal - Math.floor(ideal) }; });
    let pakai = 0; frak.forEach(o => { const t = Math.min(o.f, n[o.x] - q[o.x]); q[o.x] += t; pakai += t; }); sisa -= pakai;
    frak.sort((a, b) => b.r - a.r || n[b.x] - n[a.x]);
    for (const o of frak) { if (sisa <= 0) break; if (q[o.x] < n[o.x]) { q[o.x]++; sisa--; } }
    aktif = aktif.filter(x => q[x] < n[x]);
  }
  return q;
}
// Jumlah yang sudah mengerjakan per (kecamatan | kelas) → dasar pembagian kuota finalis
const jumlahPerKec = () => { const m = {}; skor.filter(s => !s.telat && s.kec).forEach(s => { const k = s.kec + '|' + s.kelas; m[k] = (m[k] || 0) + 1; }); return m; };
function finalisDibuka() { hasilDibuka(); if (!Object.keys(kuota).length && skor.length) isiKuota('prop'); renderFinalis(); }
function isiKuota(mode) { kuota = bagiKuota(Math.max(1, +$('#fTotal').value || 300), jumlahPerKec(), mode === 'rata' ? 'rata' : 'prop'); renderFinalis(); }
$('#bProp').onclick = () => isiKuota('prop'); $('#bRata').onclick = () => isiKuota('rata');
$('#fTotal').oninput = () => isiKuota('prop');
function pilihFinalis() {
  const per = {}; skor.filter(s => !s.telat && s.kec).forEach(s => (per[s.kec + '|' + s.kelas] = per[s.kec + '|' + s.kelas] || []).push(s));
  const hasil = { calon: [], baris: [] };
  const kecs = [...new Set([...DATA_SEKOLAH.map(x => x[0]), ...Object.keys(per).map(k => k.split('|')[0])])].sort((a, b) => a.localeCompare(b));
  kecs.forEach(kc => {
    const b = { kc, kerja: {}, kuota: {}, pilih: 0, seri: 0 };
    KELAS_LOMBA.forEach(kl => {
      const key = kc + '|' + kl, arr = per[key] || [], q = Math.min(+kuota[key] || 0, arr.length), pilih = arr.slice(0, q), akhir = pilih[pilih.length - 1];
      b.kerja[kl] = arr.length; b.kuota[kl] = +kuota[key] || 0; b.pilih += pilih.length;
      if (akhir) b.seri += arr.slice(q).filter(x => x.skor === akhir.skor && x.benar === akhir.benar && x.durasiMs === akhir.durasiMs).length;
      hasil.calon.push(...pilih);
    });
    hasil.baris.push(b);
  });
  hasil.calon.sort((a, b) => a.kec.localeCompare(b.kec) || a.kelas.localeCompare(b.kelas) || a.rkKec - b.rkKec);
  return hasil;
}
function renderFinalis() {
  if (!lihat('tFinalis')) return;
  const { calon, baris } = pilihFinalis(), totalKuota = baris.reduce((a, b) => a + KELAS_LOMBA.reduce((x, k) => x + b.kuota[k], 0), 0), S = sesiMeta();
  $('#statFinal').innerHTML = [['Total kuota', totalKuota], ['Calon terpilih', calon.length], ['Sudah mengerjakan', skor.filter(s => !s.telat).length]].map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#tbKuota').innerHTML = baris.map(b => `<tr><td>${esc(b.kc)}</td><td>${KELAS_LOMBA.map(k => b.kerja[k]).join(' / ')}</td>${KELAS_LOMBA.map(k => `<td><input type="number" min="0" value="${b.kuota[k]}" data-key="${esc(b.kc)}|${k}" style="width:70px;padding:6px"></td>`).join('')}<td><b>${b.pilih}</b>${b.pilih < KELAS_LOMBA.reduce((x, k) => x + b.kuota[k], 0) ? ' <span class="warn" title="Peserta yang mengerjakan kurang dari kuota">!</span>' : ''}</td><td>${b.seri ? `<span class="warn">⚠ ${b.seri} seri</span>` : '–'}</td></tr>`).join('') || '<tr><td colspan="7" class="mut center">Pilih sesi penyisihan.</td></tr>';
  $$('#tbKuota input').forEach(i => i.onchange = () => { kuota[i.dataset.key] = Math.max(0, +i.value || 0); renderFinalis(); });
  $('#tbFinalis').innerHTML = calon.map((s, i) => `<tr><td>${i + 1}</td><td><b>${esc(s.nama)}</b></td><td>${esc(s.kelas)}</td><td>${esc(s.asal)}</td><td>${esc(s.kec)}</td><td>${s.skor}</td><td>${fmtTime(s.durasiMs || 0)}</td></tr>`).join('') || '<tr><td colspan="7" class="mut center">Belum ada calon.</td></tr>';
  $('#infoFinal').textContent = S && S.babak !== 'penyisihan' ? '⚠ Sumber finalis harus sesi Penyisihan. Pilih sesi Penyisihan di atas.' : (totalKuota !== (+$('#fTotal').value || 0) ? `Total kuota ${totalKuota} (target ${+$('#fTotal').value || 0}).` : '');
}
$('#bTetapkan').onclick = async () => {
  const S = sesiMeta(); if (!S) return toast('Pilih sesi penyisihan dulu.');
  if (S.babak !== 'penyisihan') return toast('Sumber finalis harus sesi Penyisihan.');
  const { calon } = pilihFinalis(); if (!calon.length) return toast('Belum ada calon finalis.');
  if (!confirm(`Tetapkan ${calon.length} finalis?\nFinalis sebelumnya yang tidak terpilih akan dicabut. Hanya finalis yang bisa login di babak Final.`)) return;
  try {
    const set = new Set(calon.map(s => s.kode)), ops = [], lama = await fs.collection('peserta').where('finalis', '==', true).get();
    lama.forEach(d => { if (!set.has(d.id)) ops.push(b => b.update(refPeserta(d.id), { finalis: false })); });
    const sudah = new Set(lama.docs.map(d => d.id)); set.forEach(k => { if (!sudah.has(k)) ops.push(b => b.update(refPeserta(k), { finalis: true })); });
    await simpanBatch(ops); if (rosterMuat) muatRoster(true);
    toast(`${calon.length} finalis ditetapkan`);
  } catch (e) { toast('Gagal: ' + e.message); }
};
$('#bUnduhFinalis').onclick = () => {
  const { calon } = pilihFinalis(); if (!calon.length) return toast('Belum ada calon finalis.');
  unduhXlsx('daftar-finalis.xlsx', { Finalis: [['No', 'Nama Siswa', 'Kelas', 'Nama Sekolah', 'Kecamatan', 'Skor Penyisihan', 'Waktu']].concat(calon.map((s, i) => [i + 1, s.nama, +s.kelas || s.kelas, s.asal, s.kec, s.skor, fmtTime(s.durasiMs || 0)])) });
};
