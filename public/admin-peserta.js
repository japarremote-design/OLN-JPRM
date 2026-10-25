// ===== Admin: peserta (impor Excel, daftar, bersihkan data gladi) =====
let roster = new Map(), rosterMuat = false, rosterMemuat = false, batasP = 100, pvData = null;
const refPeserta = k => fs.collection('peserta').doc(k);

const bersih = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const judulKec = s => bersih(s).replace(/^kec(amatan|\.)?\s+/i, '').toLowerCase().replace(/(^|[\s\-\/])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const ROMAWI = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
function kelasAngka(v) {
  const s = bersih(v).toUpperCase().replace(/KELAS/g, '').replace(/^[\s:.\-]+/, '');
  let m = s.match(/^([1-6])(?!\d)/); if (m) return +m[1];
  m = s.match(/^(VI|IV|V|III|II|I)(?![IVX])/); if (m) return ROMAWI[m[1]];
  return 0;
}

// Baca baris Excel → { ok:[{n,kc,s,k}], err:[{baris,msg}], dupFile:n }
function parseSiswa(rows) {
  const hasil = { ok: [], err: [], dupFile: 0, header: false, tidakResmi: 0 };
  let h = rows.findIndex(r => r.some(c => /nama/i.test(c)) && r.some(c => /kecamatan/i.test(c)));
  if (h < 0) { hasil.err.push({ baris: 1, msg: 'Baris judul tidak ditemukan. Gunakan kolom: Nama Siswa, Kecamatan, Nama Sekolah, Kelas.' }); return hasil; }
  hasil.header = true;
  const hd = rows[h].map(c => bersih(c));
  const idx = re => hd.findIndex(c => re.test(c));
  const iKec = idx(/kecamatan/i), iKls = idx(/kelas/i), iSek = idx(/sekolah|^sd/i);
  let iNama = idx(/nama\s*(siswa|peserta|murid)|^siswa$|^peserta$/i);
  if (iNama < 0) iNama = hd.findIndex(c => /nama/i.test(c) && !/sekolah/i.test(c));
  const kurang = [['Nama Siswa', iNama], ['Kecamatan', iKec], ['Nama Sekolah', iSek], ['Kelas', iKls]].filter(x => x[1] < 0).map(x => x[0]);
  if (kurang.length) { hasil.err.push({ baris: h + 1, msg: 'Kolom tidak ditemukan: ' + kurang.join(', ') }); return hasil; }
  const lihat = new Set();
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || r.every(c => !bersih(c))) continue;
    const n = rapiNama(r[iNama]), kc0 = judulKec(r[iKec]), s0 = bersih(r[iSek]), k = kelasAngka(r[iKls]);
    const msg = !n ? 'Nama siswa kosong' : !kc0 ? 'Kecamatan kosong' : !s0 ? 'Nama sekolah kosong' : !k || k < 3 || k > 5 ? `Kelas "${bersih(r[iKls])}" tidak valid (harus 3, 4, atau 5)` : '';
    if (msg) { hasil.err.push({ baris: i + 1, msg }); continue; }
    const res = sekolahResmi(s0, kc0) || sekolahResmi(s0, ''); // samakan dengan daftar sekolah resmi
    const kc = res ? res.kec : kc0, s = res ? res.sekolah : s0; if (!res) hasil.tidakResmi = (hasil.tidakResmi || 0) + 1;
    const id = idPeserta(n, k, s); if (lihat.has(id)) { hasil.dupFile++; continue; } lihat.add(id);
    hasil.ok.push({ id, n: n.slice(0, 60), kc, s: s.slice(0, 100), k: String(k) });
  }
  return hasil;
}

// ---------- muat data ----------
async function muatRoster(paksa) {
  if (rosterMemuat || (rosterMuat && !paksa)) return; rosterMemuat = true;
  $('#infoP').textContent = 'Memuat data peserta…';
  try {
    const qs = await fs.collection('peserta').get(); roster = new Map();
    qs.forEach(d => roster.set(d.id, d.data())); rosterMuat = true;
  } catch (e) { toast('Gagal memuat peserta: ' + e.message); }
  rosterMemuat = false; renderPeserta(); isiFilterKec(); if (typeof hitungSkor === 'function') hitungSkor();
}
function pesertaDibuka() { if (typeof pastikanJawaban === 'function') pastikanJawaban(); if (!rosterMuat) muatRoster(); else renderPeserta(); }
$('#bMuatRoster').onclick = () => muatRoster(true);

function isiFilterKec() {
  const kec = DATA_SEKOLAH.map(x => x[0]);
  [['#fKec', 'Semua kecamatan'], ['#hKec', 'Semua']].forEach(([sel, label]) => {
    const e = $(sel), v = e.value; e.innerHTML = `<option value="">${label}</option>` + kec.map(k => `<option>${esc(k)}</option>`).join(''); e.value = kec.includes(v) ? v : '';
  });
}

// ---------- status login / mulai (khusus sesi Final; dibaca lewat listener sehingga hanya perubahan yang dihitung) ----------
let stLogin = new Set(), stMulai = new Set(), stKey = '', unsubL = null, unsubM = null;
const sesiFinal = () => { const S = typeof sesiMeta === 'function' ? sesiMeta() : null; return !!(S && S.babak === 'final'); };
function pastikanStatus() {
  const sid = typeof sesiDipilih !== 'undefined' ? sesiDipilih : null, key = sesiFinal() && sid ? sid : '';
  if (key === stKey) return;
  if (unsubL) unsubL(); if (unsubM) unsubM(); unsubL = unsubM = null; stKey = key; stLogin = new Set(); stMulai = new Set();
  if (!key) return;
  const FP = firebase.firestore.FieldPath, rng = c => fs.collection(c).where(FP.documentId(), '>=', key + '_').where(FP.documentId(), '<', key + '`');
  const ambil = (qs) => new Set(qs.docs.map(d => d.id.slice(key.length + 1)));
  unsubL = rng('loginfinal').onSnapshot(qs => { stLogin = ambil(qs); renderPeserta(); }, e => toast('Gagal membaca status login: ' + e.message));
  unsubM = rng('klaim').onSnapshot(qs => { stMulai = ambil(qs); renderPeserta(); }, e => toast('Gagal membaca status mulai: ' + e.message));
}
// belum login → sudah login → mengerjakan → sudah kirim
function statusPeserta(kode) {
  const kirim = typeof kirimSet !== 'undefined' ? kirimSet : new Set();
  return kirim.has(kode) ? 'kirim' : stMulai.has(kode) ? 'mulai' : stLogin.has(kode) ? 'login' : 'belum';
}
const LABEL_STATUS = { belum: '<span class="pill selesai">belum login</span>', login: '<span class="pill menunggu">sudah login</span>', mulai: '<span class="pill mulai">mengerjakan</span>', kirim: '<span class="pill mulai">sudah kirim</span>' };

// ---------- tampilan ----------
function saringPeserta() {
  const q = ($('#cariP').value || '').toLowerCase().trim(), kc = $('#fKec').value, kl = $('#fKelas').value, fin = sesiFinal(), st = fin ? $('#fStatus').value : '';
  const arr = [...roster.entries()].filter(([kode, r]) => (!fin || r.finalis) && (!kc || r.kc === kc) && (!kl || r.k === kl) && (!q || (r.n + ' ' + r.s).toLowerCase().includes(q)) && (!st || statusPeserta(kode) === st));
  arr.sort((a, b) => a[1].kc.localeCompare(b[1].kc) || a[1].s.localeCompare(b[1].s) || a[1].k.localeCompare(b[1].k) || a[1].n.localeCompare(b[1].n));
  return arr;
}
function renderPeserta() {
  pastikanStatus(); const fin = sesiFinal(); $('#fStatus').classList.toggle('hide', !fin); if (!fin) $('#fStatus').value = '';
  $('#jmlPeserta').textContent = rosterMuat ? `(${roster.size})` : '';
  const vals = [...roster.values()];
  const sek = new Set(vals.map(r => r.kc + '|' + r.s)), kec = new Set(vals.map(r => r.kc));
  const per = k => vals.filter(r => r.k === k).length;
  $('#statPeserta').innerHTML = [['Peserta', vals.length], ['Kelas 3', per('3')], ['Kelas 4', per('4')], ['Kelas 5', per('5')], ['Sekolah', sek.size], ['Kecamatan', kec.size], ['Mendaftar mandiri', vals.filter(r => !r.imp).length], ['Finalis', vals.filter(r => r.finalis).length]].concat(fin ? (() => { const f = [...roster.entries()].filter(([, r]) => r.finalis).map(([k]) => statusPeserta(k)), n = x => f.filter(v => v === x).length; return [['Belum login', n('belum')], ['Sudah login', n('login')], ['Mengerjakan', n('mulai')], ['Sudah kirim', n('kirim')]]; })() : [])
    .map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  const arr = saringPeserta();
  $('#infoP').textContent = rosterMuat ? `${arr.length} peserta sesuai filter.` : 'Data belum dimuat.';
  const kirim = typeof kirimSet !== 'undefined' ? kirimSet : new Set();
  $('#tbP').innerHTML = !arr.length ? '<tr><td colspan="7" class="mut center">Belum ada data. Impor Excel di atas atau tunggu peserta mendaftar sendiri.</td></tr>' : arr.slice(0, batasP).map(([kode, r], i) => `
    <tr><td>${i + 1}</td><td>${esc(r.n)}${r.finalis ? ' <span class="pill mulai">finalis</span>' : ''}</td><td>${esc(r.k)}</td><td>${esc(r.s)}</td><td>${esc(r.kc)}</td>
    <td>${fin ? LABEL_STATUS[statusPeserta(kode)] : (kirim.has(kode) ? '<span class="pill mulai">sudah kirim</span>' : '<span class="mut">–</span>')}</td>
    <td style="white-space:nowrap"><button class="btn ghost sm" data-reset="${kode}" title="Hapus kunci perangkat & jawaban sesi terpilih">Reset</button> <button class="btn ghost sm" data-rlogin="${kode}" title="Lepas kunci login perangkat (Final) agar peserta bisa masuk dari perangkat lain">Reset login</button> <button class="btn ghost sm" data-hapusp="${kode}">Hapus</button></td></tr>`).join('');
  $('#bMoreP').classList.toggle('hide', arr.length <= batasP);
  $$('[data-reset]').forEach(b => b.onclick = () => resetPeserta(b.dataset.reset));
  $$('[data-rlogin]').forEach(b => b.onclick = () => resetLogin(b.dataset.rlogin));
  $$('[data-hapusp]').forEach(b => b.onclick = async () => {
    const r = roster.get(b.dataset.hapusp); if (!confirm(`Hapus peserta ${r.n} (${r.s})?`)) return;
    await refPeserta(b.dataset.hapusp).delete(); roster.delete(b.dataset.hapusp); renderPeserta();
  });
}
['#cariP', '#fKec', '#fKelas', '#fStatus'].forEach(s => $(s).addEventListener('input', () => { batasP = 100; renderPeserta(); }));
$('#bMoreP').onclick = () => { batasP += 200; renderPeserta(); };
// Final: lepas kunci login perangkat saja (jawaban & waktu mulai tidak disentuh)
async function resetLogin(kode) {
  const sid = (typeof sesiDipilih !== 'undefined' && sesiDipilih) || cfg.sesi; const r = roster.get(kode);
  if (!confirm(`Reset login ${r.n}?\nKunci perangkat saat login dilepas, sehingga peserta bisa masuk dari perangkat lain. Jawaban tidak dihapus.`)) return;
  try { await fs.collection('loginfinal').doc(sid + '_' + kode).delete(); toast('Login di-reset'); }
  catch (e) { toast('Gagal: ' + e.message); }
}
async function resetPeserta(kode) {
  const sid = (typeof sesiDipilih !== 'undefined' && sesiDipilih) || cfg.sesi; const r = roster.get(kode);
  if (!confirm(`Reset ${r.n}?\nKunci perangkat dan jawaban pada sesi terpilih dihapus, sehingga peserta bisa mengerjakan ulang dari awal.`)) return;
  try {
    await fs.collection('klaim').doc(sid + '_' + kode).delete(); await fs.collection('jawaban').doc(sid + '_' + kode).delete();
    toast('Peserta di-reset');
  } catch (e) { toast('Gagal: ' + e.message); }
}

// ---------- impor ----------
$('#bTplSiswa').onclick = () => unduhXlsx('template-peserta.xlsx', { Peserta: [['Nama Siswa', 'Kecamatan', 'Nama Sekolah', 'Kelas'], ['Ahmad Fauzi', 'Bangkalan', 'SDN Kemayoran 1', 4], ['Siti Aisyah', 'Arosbaya', 'SDN Arosbaya 2', 5], ['Muhammad Rizky', 'Socah', 'SDN Socah 3', 6]] });
$('#fileSiswa').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const pv = $('#pvImpor'); pv.classList.remove('hide'); pv.innerHTML = '<p class="mut">Membaca file…</p>';
  try {
    if (!rosterMuat) await muatRoster();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
    pvData = { file: file.name, ...parseSiswa(rows), totalBaris: rows.length };
    tampilPreview();
  } catch (err) { pv.innerHTML = `<p class="warn">Gagal membaca file: ${esc(err.message)}</p>`; }
};
function tampilPreview() {
  const pv = $('#pvImpor'), d = pvData;
  d.baru = d.ok.filter(r => !roster.has(r.id)); d.sudahAda = d.ok.length - d.baru.length;
  const sek = new Set(d.ok.map(r => r.kc + '|' + r.s)), kec = new Set(d.ok.map(r => r.kc));
  const per = k => d.ok.filter(r => r.k === k).length;
  pv.innerHTML = `<div class="note biru"><b>${esc(d.file)}</b> — ${d.ok.length} baris valid dari ${Math.max(0, d.totalBaris - 1)} baris data.</div>
    <div class="stats"><div class="stat"><b>${d.ok.length}</b><span>Valid</span></div><div class="stat"><b>${kec.size}</b><span>Kecamatan</span></div><div class="stat"><b>${sek.size}</b><span>Sekolah</span></div>
    <div class="stat"><b>${per('3')} / ${per('4')} / ${per('5')}</b><span>Kelas 3 / 4 / 5</span></div><div class="stat"><b class="${d.err.length ? 'warn' : ''}">${d.err.length}</b><span>Baris bermasalah</span></div><div class="stat"><b>${d.dupFile + d.sudahAda}</b><span>Duplikat</span></div></div>
    ${d.tidakResmi ? `<div class="note">${d.tidakResmi} baris memakai nama sekolah yang tidak ada di daftar resmi (tetap diimpor apa adanya; peserta tidak akan otomatis cocok bila memilih sekolah dari dropdown).</div>` : ''}
    ${d.err.length ? `<div class="note"><b>Baris bermasalah (tidak diimpor):</b><br>${d.err.slice(0, 12).map(x => `Baris ${x.baris}: ${esc(x.msg)}`).join('<br>')}${d.err.length > 12 ? `<br>…dan ${d.err.length - 12} lainnya` : ''}</div>` : ''}
    <label class="chk"><input type="radio" name="modeImpor" value="tambah" checked> Tambahkan ke data yang ada (${d.baru.length} peserta baru${d.sudahAda ? `, ${d.sudahAda} sudah ada dilewati` : ''})</label>
    <label class="chk"><input type="radio" name="modeImpor" value="ganti"> Ganti semua data peserta (data lama dihapus)</label>
    <div class="row nofill"><button class="btn green" id="bImpor" ${d.ok.length ? '' : 'disabled'}>Impor sekarang</button><button class="btn ghost" id="bBatalImpor">Batal</button></div><p class="mut" id="progImpor"></p>`;
  $('#bBatalImpor').onclick = () => { pv.classList.add('hide'); pvData = null; };
  $('#bImpor').onclick = jalankanImpor;
}
async function jalankanImpor() {
  const d = pvData; if (!d) return;
  const ganti = $('input[name=modeImpor]:checked').value === 'ganti';
  const daftar = ganti ? d.ok : d.baru;
  if (!daftar.length) return toast('Tidak ada peserta baru untuk diimpor.');
  if (ganti && !confirm(`Ganti semua data? ${roster.size} peserta lama akan DIHAPUS.`)) return;
  if (!confirm(`Impor ${daftar.length} peserta?`)) return;
  const prog = $('#progImpor'), btn = $('#bImpor'); btn.disabled = true;
  try {
    if (ganti && roster.size) { await simpanBatch([...roster.keys()].map(k => b => b.delete(refPeserta(k))), (a, t) => prog.textContent = `Menghapus data lama… ${a}/${t}`); roster = new Map(); }
    const baru = daftar.map(r => [r.id, { n: r.n, kc: r.kc, s: r.s, k: r.k, imp: true }]);
    await simpanBatch(baru.map(([k, r]) => b => b.set(refPeserta(k), r)), (a, t) => prog.textContent = `Mengunggah peserta… ${a}/${t}`);
    baru.forEach(([k, r]) => roster.set(k, r)); rosterMuat = true;
    prog.innerHTML = `<b class="" style="color:var(--ok)">✔ ${baru.length} peserta berhasil diimpor.</b> Peserta bisa langsung login dengan nama, kelas, kecamatan, dan sekolah.`;
    toast(`${baru.length} peserta diimpor`); renderPeserta(); isiFilterKec(); pvData = null;
  } catch (err) { prog.innerHTML = `<span class="warn">Gagal: ${esc(err.message)}</span>`; btn.disabled = false; }
}

// ---------- unduh & cetak ----------
function urutPeserta(entries) { return entries.sort((a, b) => a[1].kc.localeCompare(b[1].kc) || a[1].s.localeCompare(b[1].s) || a[1].k.localeCompare(b[1].k) || a[1].n.localeCompare(b[1].n)); }
$('#bUnduhKode').onclick = () => {
  if (!roster.size) return toast('Belum ada peserta (muat data dulu).');
  const baris = (e, i) => [i + 1, e[1].n, +e[1].k, e[1].s, e[1].kc, e[1].imp ? 'terdaftar panitia' : 'daftar mandiri', e[1].finalis ? 'ya' : ''];
  const kepala = ['No', 'Nama Siswa', 'Kelas', 'Nama Sekolah', 'Kecamatan', 'Sumber', 'Finalis'];
  const urut = urutPeserta([...roster.entries()]); const sheets = { Semua: [kepala, ...urut.map(baris)] };
  const per = {}; urut.forEach(e => (per[e[1].kc] = per[e[1].kc] || []).push(e));
  Object.entries(per).forEach(([kc, arr]) => { sheets[kc.replace(/[:\\\/?*\[\]]/g, ' ').slice(0, 28)] = [kepala, ...arr.map(baris)]; });
  unduhXlsx('daftar-peserta.xlsx', sheets);
};
// Bersihkan data gladi: peserta yang mendaftar saat gladi (g = true) + semua klaim & jawaban sesi gladi
$('#bBersihGladi').onclick = async () => {
  const sesiGladi = sesiList.filter(x => x.babak === 'gladi').map(x => x.id);
  if (!confirm(`Hapus data gladi?\n• Peserta yang mendaftar saat gladi\n• Semua jawaban & kunci perangkat pada ${sesiGladi.length} sesi gladi\nData penyisihan/final TIDAK tersentuh.`)) return;
  try {
    const ops = []; const kPes = await fs.collection('peserta').where('g', '==', true).get();
    kPes.forEach(d => ops.push(b => b.delete(refPeserta(d.id))));
    for (const sid of sesiGladi) {
      const j = await fs.collection('jawaban').where('sesi', '==', sid).get(); j.forEach(d => ops.push(b => b.delete(fs.collection('jawaban').doc(d.id))));
      const k = await fs.collection('klaim').get(); k.forEach(d => { if (d.id.startsWith(sid + '_')) ops.push(b => b.delete(fs.collection('klaim').doc(d.id))); });
    }
    await simpanBatch(ops); await muatRoster(true); toast(`${ops.length} dokumen gladi dihapus`);
  } catch (e) { toast('Gagal: ' + e.message); }
};
