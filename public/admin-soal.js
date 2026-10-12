// ===== Admin: bank soal (gambar, impor/ekspor) =====
let editId = null, formGambar = { q: '', o: ['', '', '', ''] };
const BATAS_DOK = 950000;

const soalValid = q => !!((String(q.t || '').trim() || q.g) && q.o && q.o.length === 4 && q.o.every(opsiAdaIsi) && q.k >= 0 && q.k <= 3);
const idSoalBaru = () => 's' + Date.now().toString(36) + acakId(4);
const tbBersih = tb => (Array.isArray(tb) ? tb : String(tb || '').split('\n')).map(r => String(r).trim()).filter(Boolean).slice(0, 30);
const dariDaftar = list => list.map((s, i) => ({ id: 's' + String(i + 1).padStart(3, '0') + acakId(3), t: String(s.t || '').trim(), g: urlAman(s.g), tb: tbBersih(s.tb), o: s.o.map(normOpsi).map(o => ({ t: o.t.trim(), g: urlAman(o.g) })), k: s.k }));
const ukuranBank = list => new Blob([JSON.stringify(list.map(q => ({ id: q.id, t: q.t, g: q.g, tb: q.tb, o: q.o })))]).size;
const NAMA_B = { gladi: 'Gladi', penyisihan: 'Penyisihan', final: 'Final' };

function soalBerubah() {
  $('#jmlSoal').textContent = `(${bank.length})`;
  $('#ringkasBank').innerHTML = 'Jumlah soal ' + NAMA_B[babakSoal] + ': ' + KELAS_LOMBA.map(k => `kelas ${k} = <b class="${bankDari(babakSoal, k).length === 50 ? '' : 'warn'}">${bankDari(babakSoal, k).length}</b>`).join(' · ') + ' (target 50 per kelas)';
  const u = ukuranBank(bank), ada = bank.filter(q => q.g || q.o.some(o => o.g)).length;
  $('#infoUkuran').innerHTML = `Ukuran paket soal: <b class="${u > BATAS_DOK ? 'warn' : ''}">${Math.round(u / 1024)} KB</b> dari batas ±950 KB · ${ada} soal bergambar${CLOUDINARY.cloud ? '' : ' · <span class="warn">Cloudinary belum diatur → gambar disimpan kecil di dalam soal</span>'}`;
  $('#daftarSoal').innerHTML = !bank.length ? '<div class="card center mut">Belum ada soal untuk babak & kelas ini. Impor file Excel/JSON atau tambah manual.</div>' :
    `<div class="card"><p class="mut" style="margin-top:0">${NAMA_B[babakSoal]} · Kelas ${kelasSoal} · ${bank.length} soal${bank.length !== 50 ? ' (target 50)' : ''}</p>` + bank.map((q, i) => `
    <div class="soal-item"><b>${i + 1}. ${esc(q.t).replace(/\n\n/g, '<br><br>')}</b>${soalValid(q) ? '' : ' <span class="pill selesai">belum lengkap</span>'}
      ${q.tb && q.tb.length ? `<table class="tb-mini">${q.tb.map(r => `<tr>${String(r).split('|').map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : ''}
      ${q.g ? `<div><img src="${esc(q.g)}" alt=""></div>` : ''}
      <ol type="A">${q.o.map((o, j) => `<li class="${q.k === j ? 'k' : ''}">${esc(o.t)} ${o.g ? `<img src="${esc(o.g)}" alt="">` : ''}${q.k === j ? ' ✓' : ''}</li>`).join('')}</ol>
      <div class="row nofill"><button class="btn ghost sm" data-e="${q.id}">Edit</button><button class="btn ghost sm" data-h="${q.id}">Hapus</button><button class="btn ghost sm" data-up="${q.id}" title="Naikkan">↑</button></div>
    </div>`).join('') + '</div>';
  $$('[data-e]').forEach(b => b.onclick = () => bukaForm(b.dataset.e));
  $$('[data-h]').forEach(b => b.onclick = () => { if (bolehUbah() && confirm('Hapus soal ini?')) simpanBank(bank.filter(q => q.id !== b.dataset.h)); });
  $$('[data-up]').forEach(b => b.onclick = () => { const i = bank.findIndex(q => q.id === b.dataset.up); if (i > 0 && bolehUbah()) { const a = bank.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; simpanBank(a); } });
}
const bolehUbah = () => { if (cfg.status === 'mulai' && cfg.babak === babakSoal) { toast('Sesi sedang dibuka, soal tidak bisa diubah.'); return false; } return true; };
function simpanBank(list) {
  if (ukuranBank(list) > BATAS_DOK) { toast('Ukuran soal melebihi batas ±950 KB. Gunakan Cloudinary untuk gambar atau kurangi gambar.'); return Promise.reject(new Error('terlalu besar')); }
  return docBankSel().set({ soal: list.map(q => ({ id: q.id, t: q.t, g: q.g || '', ...(q.tb && q.tb.length ? { tb: q.tb } : {}), o: q.o.map(o => ({ t: o.t || '', g: o.g || '' })), k: q.k })) }).catch(err => { toast('Gagal: ' + err.message); throw err; });
}

// ---------- gambar ----------
async function bacaBitmap(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch (e) { /* lanjut */ } }
  return await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('file bukan gambar')); im.src = URL.createObjectURL(file); });
}
async function kecilkan(file, maxDim, kualitas) {
  const im = await bacaBitmap(file), w0 = im.width || im.naturalWidth, h0 = im.height || im.naturalHeight;
  const s = Math.min(1, maxDim / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
  return await new Promise(r => c.toBlob(r, 'image/jpeg', kualitas));
}
const blobKeDataUrl = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function unggahGambar(file, maxDim) {
  if (file.size > 15 * 1024 * 1024) throw new Error('gambar terlalu besar (maks 15 MB)');
  if (CLOUDINARY.cloud && CLOUDINARY.preset) {
    const blob = await kecilkan(file, maxDim, 0.85), fd = new FormData();
    fd.append('file', blob, 'soal.jpg'); fd.append('upload_preset', CLOUDINARY.preset);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloud}/image/upload`, { method: 'POST', body: fd });
    const j = await r.json(); if (!r.ok || !j.secure_url) throw new Error((j.error && j.error.message) || 'unggah gagal');
    return j.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
  }
  return await blobKeDataUrl(await kecilkan(file, Math.min(maxDim, 420), 0.7)); // cadangan: gambar kecil disematkan
}

// ---------- form ----------
$('#fsOpsi').innerHTML = HURUF.map((h, i) => `<label>Opsi ${h}</label><input name="o${i}" placeholder="Teks opsi ${h} (boleh kosong jika memakai gambar)">
  <div class="imgup" data-img="${i}"><img class="hide" alt=""><button type="button" class="btn ghost sm" data-act="pilih">Gambar opsi…</button><button type="button" class="btn ghost sm hide" data-act="hapus">Hapus gambar</button><input type="file" accept="image/*" hidden></div>`).join('');
function tampilGambar() {
  $$('#fSoal .imgup').forEach(box => {
    const key = box.dataset.img, url = key === 'q' ? formGambar.q : formGambar.o[+key], im = $('img', box);
    im.classList.toggle('hide', !url); if (url) im.src = url; else im.removeAttribute('src');
    $('[data-act=hapus]', box).classList.toggle('hide', !url);
    $('[data-act=pilih]', box).textContent = url ? 'Ganti gambar…' : (key === 'q' ? 'Gambar soal…' : 'Gambar opsi…');
  });
}
$$('#fSoal .imgup').forEach(box => {
  const key = box.dataset.img, input = $('input[type=file]', box), bPilih = $('[data-act=pilih]', box);
  const set = u => { if (key === 'q') formGambar.q = u; else formGambar.o[+key] = u; tampilGambar(); };
  bPilih.onclick = () => input.click();
  $('[data-act=hapus]', box).onclick = () => set('');
  input.onchange = async () => {
    const f = input.files[0]; input.value = ''; if (!f) return;
    bPilih.disabled = true; bPilih.textContent = 'Mengunggah…';
    try { set(await unggahGambar(f, key === 'q' ? 900 : 560)); } catch (e) { toast('Gagal unggah gambar: ' + e.message); }
    bPilih.disabled = false; tampilGambar();
  };
});
function bukaForm(id) {
  editId = id || null; $('#fSoal').reset(); const f = $('#fSoal').elements;
  $('#fsJudul').textContent = id ? 'Edit soal' : 'Tambah soal';
  formGambar = { q: '', o: ['', '', '', ''] };
  if (id) { const q = bank.find(x => x.id === id); f.t.value = q.t; f.tb.value = (q.tb || []).join('\n'); q.o.forEach((o, i) => { f['o' + i].value = o.t; formGambar.o[i] = o.g || ''; }); formGambar.q = q.g || ''; f.k.value = q.k; }
  tampilGambar(); $('#formSoal').classList.remove('hide'); $('#formSoal').scrollIntoView({ behavior: 'smooth' }); f.t.focus();
}
$('#bTambah').onclick = () => bukaForm();
$('#bBatal').onclick = () => $('#formSoal').classList.add('hide');
$('#fSoal').onsubmit = e => {
  e.preventDefault(); if (!bolehUbah()) return; const f = e.target.elements;
  const q = { id: editId || idSoalBaru(), t: f.t.value.trim(), g: formGambar.q, tb: tbBersih(f.tb.value), o: [0, 1, 2, 3].map(i => ({ t: f['o' + i].value.trim(), g: formGambar.o[i] })), k: +f.k.value };
  if (!soalValid(q)) return toast('Pertanyaan dan tiap opsi harus berisi teks atau gambar.');
  simpanBank(editId ? bank.map(x => x.id === editId ? q : x) : [...bank, q]).then(() => { $('#formSoal').classList.add('hide'); toast('Soal disimpan'); }).catch(() => {});
};
$('#bContoh').onclick = () => {
  if (!bolehUbah() || (bank.length && !confirm('Ganti semua soal babak & kelas ini dengan 30 soal contoh?'))) return;
  simpanBank(dariDaftar(SOAL_CONTOH)).then(() => toast('30 soal contoh dimuat')).catch(() => {});
};
$('#bHapusSoal').onclick = () => { if (bolehUbah() && confirm('Hapus SEMUA soal?')) simpanBank([]).catch(() => {}); };

// ---------- ekspor ----------
const KEPALA_SOAL = ['Soal', 'Gambar Soal', 'A', 'Gambar A', 'B', 'Gambar B', 'C', 'Gambar C', 'D', 'Gambar D', 'Kunci', 'Tabel'];
const selGambar = u => !u ? '' : u.startsWith('data:') ? '[gambar tertanam — gunakan Ekspor JSON]' : u;
const baris = q => [q.t, selGambar(q.g), ...q.o.flatMap(o => [o.t, selGambar(o.g)]), HURUF[q.k], (q.tb || []).join('\n')];
$('#bEksporSoal').onclick = () => unduh(`soal-${babakSoal}-kelas-${kelasSoal}.json`, JSON.stringify(bank.map(({ t, g, tb, o, k }) => ({ t, g, tb, o, k })), null, 2), 'application/json');
$('#bEksporX').onclick = () => { if (!bank.length) return toast('Belum ada soal.'); unduhXlsx(`soal-${babakSoal}-kelas-${kelasSoal}.xlsx`, { Soal: [KEPALA_SOAL, ...bank.map(baris)] }); };
$('#bTplSoal').onclick = () => unduhXlsx('template-soal.xlsx', { Soal: [KEPALA_SOAL,
  ['Ibu kota Provinsi Jawa Timur adalah ...', '', 'Malang', '', 'Surabaya', '', 'Sidoarjo', '', 'Kediri', '', 'B'],
  ['Perhatikan gambar! Bangun datar di samping adalah ...', 'https://contoh.com/gambar-soal.jpg', 'Persegi', '', 'Segitiga', '', 'Lingkaran', '', 'Trapesium', '', 'A'],
  ['Manakah gambar buah apel?', '', '', 'https://contoh.com/apel.jpg', '', 'https://contoh.com/jeruk.jpg', '', 'https://contoh.com/pisang.jpg', '', 'https://contoh.com/anggur.jpg', 'A']] });

// ---------- impor ----------
const nk = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const kunciKeIdx = v => { if (typeof v === 'number') return v >= 0 && v <= 3 ? v : (v >= 1 && v <= 4 ? v - 1 : -1); const s = String(v ?? '').trim().toUpperCase(); const i = HURUF.indexOf(s); return i >= 0 ? i : (/^[1-4]$/.test(s) ? +s - 1 : -1); };
function soalDariBaris(rows) { // → { list, err:[] }
  const hasil = { list: [], err: [] };
  const h = rows.findIndex(r => r.some(c => ['soal', 'pertanyaan'].includes(nk(c))));
  if (h < 0) { hasil.err.push('Baris judul tidak ditemukan (kolom pertama harus bernama "Soal").'); return hasil; }
  const hd = rows[h].map(nk), cari = (...n) => hd.findIndex(c => n.includes(c));
  const ix = { tb: cari('tabel'), t: cari('soal', 'pertanyaan'), g: cari('gambarsoal', 'gambar', 'imgsoal'), k: cari('kunci', 'kuncijawaban', 'jawabanbenar', 'jawaban'), o: [], og: [] };
  HURUF.forEach(L => { const l = L.toLowerCase(); ix.o.push(cari(l, 'opsi' + l, 'pilihan' + l, 'jawaban' + l)); ix.og.push(cari('gambar' + l, 'img' + l, 'gambaropsi' + l, 'gambarpilihan' + l)); });
  if (ix.o.some(i => i < 0) || ix.k < 0) { hasil.err.push('Kolom A, B, C, D, dan Kunci wajib ada.'); return hasil; }
  const url = v => { const s = String(v ?? '').trim(); return urlAman(s); };
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || r.every(c => !String(c ?? '').trim())) continue;
    const q = { t: String(r[ix.t] ?? '').trim(), g: ix.g >= 0 ? url(r[ix.g]) : '', tb: ix.tb >= 0 ? tbBersih(r[ix.tb]) : [], o: ix.o.map((c, j) => ({ t: String(r[c] ?? '').trim(), g: ix.og[j] >= 0 ? url(r[ix.og[j]]) : '' })), k: kunciKeIdx(r[ix.k]) };
    if (!soalValid(q)) { hasil.err.push(`Baris ${i + 1}: soal/opsi kosong atau kunci bukan A–D`); continue; }
    hasil.list.push(q);
  }
  return hasil;
}
function soalDariJson(arr) {
  const hasil = { list: [], err: [] };
  if (!Array.isArray(arr)) { hasil.err.push('JSON harus berupa daftar (array) soal.'); return hasil; }
  arr.forEach((x, i) => {
    const q = { t: String(x.t ?? x.soal ?? '').trim(), g: urlAman(x.g ?? x.gambar), tb: tbBersih(x.tb ?? x.tabel), o: (x.o ?? x.opsi ?? []).map(normOpsi).map(o => ({ t: o.t.trim(), g: urlAman(o.g) })), k: kunciKeIdx(x.k ?? x.kunci) };
    if (!soalValid(q)) hasil.err.push(`Soal ke-${i + 1}: tidak lengkap (perlu 4 opsi + kunci)`); else hasil.list.push(q);
  });
  return hasil;
}
$('#fileImpor').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file || !bolehUbah()) return;
  try {
    let r;
    if (/\.json$/i.test(file.name)) r = soalDariJson(JSON.parse(await file.text()));
    else { const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); r = soalDariBaris(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })); }
    if (r.err.length) return toast(r.err.slice(0, 3).join(' · ') + (r.err.length > 3 ? ` (+${r.err.length - 3} lagi)` : ''));
    if (!r.list.length) return toast('Tidak ada soal di file.');
    const ganti = bank.length ? confirm(`Impor ${r.list.length} soal.\nOK = ganti semua soal lama\nBatal = tambahkan ke soal lama`) : true;
    const baru = dariDaftar(r.list);
    simpanBank(ganti ? baru : [...bank, ...baru]).then(() => toast(`${r.list.length} soal diimpor`)).catch(() => {});
  } catch (err) { toast('Gagal membaca file: ' + err.message); }
};

// ---------- pilih babak & kelas ----------
$('#selBabakSoal').onchange = e => { babakSoal = e.target.value; pilihBank(); };
$('#selKelasSoal').onchange = e => { kelasSoal = e.target.value; pilihBank(); };
