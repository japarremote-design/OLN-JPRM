// ===== Admin: inti (login, tab, kontrol sesi) =====
buatHeader('Panel Admin / Panitia');
let cfg = {}, bank = [], banks = {}, babakSoal = 'penyisihan', kelasSoal = '3', babakAwal = false, sesiList = [], papanTampil = false, sudahPasang = false, tickInt = null;
const bankId = (b, k) => `bank_${b}_${k}`;
const docBankSel = () => fs.collection('admin').doc(bankId(babakSoal, kelasSoal));
const bankDari = (b, k) => banks[bankId(b, k)] || [];
const pilihBank = () => { bank = bankDari(babakSoal, kelasSoal); soalBerubah(); renderStatus(); };
const WIB_MS = s => new Date(s).getTime();
const DEFAULT_CFG = {
  judul: DEFAULT_JUDUL, babak: 'penyisihan', jadwal: 'jendela', timer: 'total', durasiMenit: 60, detikPerSoal: 30,
  poinBenar: 2, poinSalah: 0, acakSoal: true, acakOpsi: false, tampilSkor: false, daftarMandiri: true, status: 'menunggu', jumlahSoal: 50,
  bukaAt: WIB_MS('2026-10-17T07:00:00+07:00'), tutupAt: WIB_MS('2026-10-17T15:00:00+07:00')
};
const NAMA_BABAK = { gladi: 'Gladi', penyisihan: 'Penyisihan', final: 'Final' };

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
const TAB = ['kontrol', 'peserta', 'soal', 'hasil', 'finalis'];
function bukaTab(t) {
  $$('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t));
  TAB.forEach(x => $('#t' + x[0].toUpperCase() + x.slice(1)).classList.toggle('hide', x !== t));
  if (t === 'peserta') pesertaDibuka(); else if (t === 'hasil') hasilDibuka(); else if (t === 'finalis') finalisDibuka();
}
$$('.tabs button').forEach(b => b.onclick = () => bukaTab(b.dataset.t));

// ---------- Listener ----------
function pasangListener() {
  if (sudahPasang) return; sudahPasang = true;
  docConfig.onSnapshot(s => {
    if (!s.exists) { docConfig.set({ ...DEFAULT_CFG, sesi: acakId(8) }); return; }
    cfg = { ...DEFAULT_CFG, ...s.data() };
    if (!babakAwal) { babakAwal = true; babakSoal = cfg.babak || 'penyisihan'; $('#selBabakSoal').value = babakSoal; }
    setJudul(cfg.judul); isiFormCfg(); renderStatus(); sesiBerubah();
  });
  fs.collection('admin').onSnapshot(qs => {
    banks = {}; qs.docs.forEach(d => { if (d.id.startsWith('bank_')) banks[d.id] = ((d.data() || {}).soal || []).map(q => ({ ...q, o: (q.o || []).map(normOpsi) })); });
    pilihBank();
  });
  fs.collection('sesi').onSnapshot(qs => {
    sesiList = qs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => tsMs(b.dibuat) - tsMs(a.dibuat));
    sesiBerubah();
  });
  docPapan.onSnapshot(s => { papanTampil = !!(s.data() || {}).tampil; $('#cPapan').checked = papanTampil; });
  clearInterval(tickInt); tickInt = setInterval(renderTimer, 500);
}

// ---------- Kontrol ----------
const totalMs = () => cfg.timer === 'soal' ? (cfg.detikPerSoal || 30) * 1000 * (cfg.jumlahSoal || 50) : (cfg.durasiMenit || 60) * 60000;
const terkunci = () => !!cfg.paketKelas; // sesi sudah pernah dibuka → pengaturan inti dikunci
function isiFormCfg() {
  const form = $('#fCfg'); if (form.contains(document.activeElement)) return;
  const f = form.elements;
  ['judul', 'babak', 'jadwal', 'timer', 'durasiMenit', 'detikPerSoal', 'poinBenar', 'poinSalah'].forEach(k => f[k].value = cfg[k]);
  f.tampilSkor.checked = !!cfg.tampilSkor; f.daftarMandiri.checked = cfg.daftarMandiri !== false;
  f.bukaAt.value = keInputWaktu(cfg.bukaAt); f.tutupAt.value = keInputWaktu(cfg.tutupAt);
  f.acakSoal.checked = !!cfg.acakSoal; f.acakOpsi.checked = !!cfg.acakOpsi;
  const kunci = terkunci();
  ['judul', 'babak', 'jadwal', 'timer', 'durasiMenit', 'detikPerSoal', 'poinBenar', 'poinSalah', 'acakSoal', 'acakOpsi'].forEach(k => f[k].disabled = kunci);
  $('#rJendela').classList.toggle('hide', cfg.jadwal === 'serentak');
  $('#catatCfg').textContent = kunci ? 'Sesi ini sudah pernah dibuka: hanya jadwal buka/tutup yang bisa diubah. Untuk mengubah yang lain, buat Sesi baru.' : '';
}
$('#fCfg').elements.jadwal.onchange = e => $('#rJendela').classList.toggle('hide', e.target.value === 'serentak');
$('#fCfg').onsubmit = async e => {
  e.preventDefault(); const f = e.target.elements;
  const waktu = { bukaAt: dariInputWaktu(f.bukaAt.value), tutupAt: dariInputWaktu(f.tutupAt.value) };
  if (waktu.bukaAt && waktu.tutupAt && waktu.tutupAt <= waktu.bukaAt) return toast('Waktu tutup harus setelah waktu buka.');
  try {
    const umum = { tampilSkor: f.tampilSkor.checked, daftarMandiri: f.daftarMandiri.checked };
    if (terkunci()) {
      await docConfig.update({ ...waktu, daftarMandiri: umum.daftarMandiri });
      await fs.collection('sesi').doc(cfg.sesi).set(waktu, { merge: true });
    } else {
      await docConfig.update({
        judul: f.judul.value.trim() || DEFAULT_JUDUL, babak: f.babak.value, jadwal: f.jadwal.value, timer: f.timer.value,
        durasiMenit: Math.max(1, +f.durasiMenit.value || 30), detikPerSoal: Math.max(5, +f.detikPerSoal.value || 30),
        poinBenar: +f.poinBenar.value || 0, poinSalah: +f.poinSalah.value || 0,
        acakSoal: f.acakSoal.checked, acakOpsi: f.acakOpsi.checked, ...umum, ...waktu
      });
    }
    document.activeElement.blur(); toast('Pengaturan disimpan');
  } catch (err) { toast('Gagal: ' + err.message); }
};
function renderStatus() {
  const st = cfg.status || 'menunggu';
  const p = $('#stPill'); p.className = 'pill ' + st; p.textContent = { menunggu: 'Belum dibuka', mulai: 'Dibuka', selesai: 'Ditutup' }[st];
  $('#bMulai').disabled = st === 'mulai' || (st === 'selesai' && cfg.jadwal === 'serentak');
  $('#bAkhiri').disabled = st !== 'mulai'; $('#bBaru').disabled = st === 'mulai';
  const timer = cfg.timer === 'soal' ? `${cfg.detikPerSoal} dtk/soal` : `${cfg.durasiMenit} menit`;
  $('#stInfo').textContent = `${NAMA_BABAK[cfg.babak] || cfg.babak} · ${cfg.jadwal === 'serentak' ? 'serentak' : 'jendela waktu'} · soal kelas 3/4/5 · ${timer} · sesi ${cfg.sesi || '-'}`
    + (cfg.jadwal !== 'serentak' ? `\nBuka: ${fmtTgl(cfg.bukaAt)} → Tutup: ${fmtTgl(cfg.tutupAt)}` : '');
  $('#stInfo').style.whiteSpace = 'pre-line';
  renderTimer();
}
function renderTimer() {
  const el = $('#stTimer'), t = nowServer();
  if (cfg.status === 'selesai') { el.textContent = 'DITUTUP'; return; }
  if (cfg.status !== 'mulai') { el.textContent = fmtTime(totalMs()); return; }
  if (cfg.jadwal === 'serentak') {
    const sisa = tsMs(cfg.mulaiAt) + (cfg.durasiTotalMs || 0) - t; el.textContent = fmtTime(sisa);
    if (tsMs(cfg.mulaiAt) && sisa < -5000) docConfig.update({ status: 'selesai', selesaiAt: SERVER_TS }); // tutup otomatis
  } else if (cfg.tutupAt && t > cfg.tutupAt + (cfg.durasiTotalMs || 0) + 10 * 60000) {
    docConfig.update({ status: 'selesai', selesaiAt: SERVER_TS }); // jendela + durasi + toleransi sudah lewat → tutup otomatis
  } else if (cfg.bukaAt && t < cfg.bukaAt) el.textContent = 'Buka ' + fmtTime(cfg.bukaAt - t).replace(/^/, 'dlm ');
  else if (cfg.tutupAt && t >= cfg.tutupAt) el.textContent = 'JENDELA TUTUP';
  else el.textContent = cfg.tutupAt ? 'TERBUKA · ' + fmtTime(cfg.tutupAt - t) : 'TERBUKA';
}
$('#bMulai').onclick = async () => {
  const sets = KELAS_LOMBA.map(k => [k, bankDari(cfg.babak, k)]);
  const kosong = sets.filter(([, l]) => !l.length).map(([k]) => k);
  if (kosong.length) return toast(`Soal ${NAMA_BABAK[cfg.babak]} untuk kelas ${kosong.join(', ')} belum ada (tab Soal).`);
  for (const [k, l] of sets) { const r = l.findIndex(q => !soalValid(q)); if (r >= 0) return toast(`Kelas ${k}: soal ke-${r + 1} belum lengkap (isi/gambar atau kunci).`); }
  if (cfg.babak === 'final') {
    const nFinal = rosterMuat ? [...roster.values()].filter(r => r.finalis).length : -1;
    if (nFinal === 0) return toast('Belum ada finalis. Tetapkan finalis dulu di tab Finalis.');
  }
  const jdw = cfg.jadwal === 'serentak' ? 'Serentak: soal langsung tampil di semua HP yang sudah login.' : `Jendela: ${fmtTgl(cfg.bukaAt)} → ${fmtTgl(cfg.tutupAt)}`;
  const jml = sets.map(([k, l]) => `kelas ${k}: ${l.length}`).join(' · ');
  if (!confirm(`Buka sesi ${NAMA_BABAK[cfg.babak]}?\n${jml}\n${cfg.timer === 'soal' ? cfg.detikPerSoal + ' dtk/soal' : cfg.durasiMenit + ' menit'}\n${jdw}`)) return;
  try {
    let paketKelas = cfg.paketKelas;
    const maks = Math.max(...sets.map(([, l]) => l.length));
    if (!paketKelas) {
      paketKelas = {}; const kunci = {}, jmlKelas = {};
      for (const [k, l] of sets) {
        const id = acakId(24); // ID acak: soal tidak bisa diintip sebelum dibuka
        const soal = l.map(q => ({ id: q.id, t: q.t || '', g: q.g || '', ...(q.tb && q.tb.length ? { tb: q.tb } : {}), o: q.o.map(o => ({ t: o.t || '', g: o.g || '' })) }));
        const ukuran = new Blob([JSON.stringify(soal)]).size;
        if (ukuran > 950000) return toast(`Soal kelas ${k} berukuran ${Math.round(ukuran / 1024)} KB, melebihi batas ±950 KB. Unggah gambar lewat Cloudinary.`);
        const dok = { soal }; if (cfg.tampilSkor) dok.kunci = Object.fromEntries(l.map(q => [q.id, q.k]));
        await fs.collection('paket').doc(id).set(dok);
        paketKelas[k] = id; kunci[k] = Object.fromEntries(l.map(q => [q.id, q.k])); jmlKelas[k] = l.length;
      }
      await fs.collection('sesi').doc(cfg.sesi).set({
        babak: cfg.babak, nama: `${NAMA_BABAK[cfg.babak]} · ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`, paketKelas,
        kunci, jumlahSoalKelas: jmlKelas, jumlahSoal: maks, poinBenar: cfg.poinBenar, poinSalah: cfg.poinSalah,
        jadwal: cfg.jadwal, timer: cfg.timer, durasiTotalMs: totalMs(), bukaAt: cfg.bukaAt || null, tutupAt: cfg.tutupAt || null, dibuat: SERVER_TS
      });
    }
    const upd = { status: 'mulai', paketKelas, paketList: Object.values(paketKelas), durasiTotalMs: totalMs(), jumlahSoal: maks };
    if (cfg.jadwal === 'serentak') { upd.mulaiAt = SERVER_TS; await fs.collection('sesi').doc(cfg.sesi).update({ mulaiAt: SERVER_TS }); }
    await docConfig.update(upd);
    toast('Sesi dibuka');
  } catch (err) { toast('Gagal membuka sesi: ' + err.message); }
};
$('#bAkhiri').onclick = () => { if (confirm('Tutup sesi sekarang?\nPeserta yang masih mengerjakan langsung mengirim jawabannya.')) docConfig.update({ status: 'selesai', selesaiAt: SERVER_TS }); };
$('#bBaru').onclick = async () => {
  if (cfg.status === 'mulai') return toast('Tutup sesi dulu.');
  if (!confirm('Buat sesi baru?\nPeserta mulai dari awal di sesi baru. Hasil sesi lama tetap tersimpan di tab Hasil.')) return;
  await docConfig.update({ sesi: acakId(8), status: 'menunggu', mulaiAt: null, paketKelas: null, paketList: [] });
  toast('Sesi baru siap — atur babak/jadwal lalu buka sesi.');
};
$('#cPapan').onchange = e => { papanTampil = e.target.checked; if (typeof papanTerakhir !== 'undefined') papanTerakhir = ''; docPapan.set({ sesi: cfg.sesi, tampil: papanTampil, top: [], kec: {}, total: 0, update: SERVER_TS }, { merge: true }); };

// ---------- util umum admin ----------
function unduh(nama, isi, tipe) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([isi], { type: tipe })); a.download = nama; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function unduhXlsx(nama, sheets) { // sheets: { "Nama Sheet": [[baris],...] }
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([n, aoa]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = (aoa[0] || []).map((_, i) => ({ wch: Math.min(60, Math.max(8, ...aoa.slice(0, 200).map(r => String(r[i] ?? '').length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, n.slice(0, 31));
  });
  XLSX.writeFile(wb, nama);
}
async function simpanBatch(ops, onProg) { // ops: [(batch)=>void], 400 per batch
  for (let i = 0; i < ops.length; i += 400) {
    const b = fs.batch(); ops.slice(i, i + 400).forEach(fn => fn(b)); await b.commit();
    if (onProg) onProg(Math.min(i + 400, ops.length), ops.length);
  }
}
