// Medali (SVG, tampil di semua perangkat): 1 emas, 2 perak, 3 perunggu, Harapan 1 hijau-tosca bintang
const MEDALI = [['#f5b301', '#b88700', '1'], ['#cfd8e3', '#8693a6', '2'], ['#d9843b', '#8f4f17', '3'], ['#2dd4bf', '#0f8f80', '★']];
const medali = i => { const [a, b, t] = MEDALI[i]; return `<svg width="34" height="40" viewBox="0 0 34 40" aria-label="${['Juara 1', 'Juara 2', 'Juara 3', 'Harapan 1'][i]}"><path d="M9 0h6l3 14h-7zM25 0h-6l-3 14h7z" fill="${i === 3 ? '#0f8f80' : '#c0392b'}"/><circle cx="17" cy="25" r="13" fill="${a}" stroke="${b}" stroke-width="2.5"/><circle cx="17" cy="25" r="9" fill="none" stroke="${b}" stroke-width="1" opacity=".5"/><text x="17" y="30" text-anchor="middle" font-size="${t === '★' ? 15 : 14}" font-weight="900" font-family="system-ui,sans-serif" fill="${i === 1 ? '#475569' : '#fff'}">${t}</text></svg>`; };
// Papan skor publik. Hanya membaca 2 dokumen kecil (config/lomba & publik/papan) yang diperbarui admin.
buatHeader('Jawa Pos Radar Madura · Papan Skor Langsung');
let cfg = {}, papan = {}, pilih = '', pilihKelas = '3', tampilN = 100;
const norm = t => String(t || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
// Seluruh peserta per kelas (dokumen publik/semua_<kelas>, diambil saat kelas dipilih & tiap 150 dtk). Bila belum ada → ringkasan lama.
const semuaCache = {};
function semuaKelas(k) {
  const c = semuaCache[k]; if (!c || c.sesi !== cfg.sesi || !c.tampil) return null; return c.rows;
}
async function muatSemua(k, paksa) {
  const c = semuaCache[k];
  if (!paksa && c && Date.now() - c.at < 150000) return;
  if (c && c.sedang) return; semuaCache[k] = { ...(c || {}), sedang: true };
  try {
    const s = await fs.collection('publik').doc('semua_' + k).get(), d = s.data();
    if (d && Array.isArray(d.rows)) semuaCache[k] = { sesi: d.sesi, tampil: !!d.tampil, at: Date.now(), rows: d.rows.map(t => { const [n, sk, kc, b, skor, dur] = String(t).split('\t'); return { n, s: sk, kc, k, b: +b, sk: +skor, d: dur === '' || dur == null ? null : +dur }; }) };
    else semuaCache[k] = { at: Date.now() };
  } catch (e) { semuaCache[k] = { ...(semuaCache[k] || {}), sedang: false, at: Date.now() - 100000 }; }
  render();
}

// Hemat kuota baca: ambil 2 dokumen kecil tiap 60 detik (bukan listener langsung)
async function muat() {
  try { const [c, p] = await Promise.all([docConfig.get(), docPapan.get()]); cfg = c.data() || {}; papan = p.data() || {}; setJudul(cfg.judul); render(); muatSemua(pilihKelas); } catch (e) { /* coba lagi 60 dtk */ }
}
muat(); setInterval(muat, 60000);
setInterval(timer, 500);

function timer() {
  const el = $('#tmr'); if (!el) return;
  const t = nowServer(); let teks = 'SIAP', warn = false;
  if (cfg.status === 'selesai') teks = 'DITUTUP';
  else if (cfg.status === 'mulai') {
    if (cfg.jadwal === 'serentak') { const s = tsMs(cfg.mulaiAt) + (cfg.durasiTotalMs || 0) - t; teks = tsMs(cfg.mulaiAt) ? fmtTime(s) : 'MULAI'; warn = s < 30000; }
    else if (cfg.bukaAt && t < cfg.bukaAt) teks = 'Dibuka ' + fmtTgl(cfg.bukaAt);
    else if (cfg.tutupAt && t < cfg.tutupAt) teks = 'Ditutup dlm ' + fmtTime(cfg.tutupAt - t);
    else teks = 'JENDELA TUTUP';
  }
  el.textContent = teks; el.classList.toggle('warn', warn);
}

function render() {
  const st = cfg.status || 'menunggu';
  const pl = $('#st'); pl.className = 'pill ' + st; pl.textContent = { menunggu: 'Belum dibuka', mulai: 'Berlangsung', selesai: 'Ditutup' }[st] || st;
  const sah = papan.sesi && papan.sesi === cfg.sesi;
  const babak = { final: 'Babak Final', gladi: 'Gladi Resik' }[cfg.babak] || 'Babak Penyisihan';
  if (!sah || !papan.tampil) {
    $('#info').textContent = babak;
    $('#kontrol').classList.add('hide');
    $('#list').innerHTML = `<p class="center" style="opacity:.75;padding:50px 0">${sah ? 'Papan skor akan dibuka panitia.' : 'Belum ada hasil untuk sesi ini.'}</p>`;
    return timer();
  }
  $('#info').textContent = `${babak} · ${papan.total || 0} peserta sudah mengumpulkan`;
  const kecs = Object.keys(papan.kec || {}).sort((a, b) => a.localeCompare(b));
  const sel = $('#selKec'), selK = $('#selKelas');
  const opsi = '<option value="">Se-Kabupaten Bangkalan</option>' + kecs.map(k => `<option value="${esc(k)}">Kecamatan ${esc(k)}</option>`).join('');
  if (sel.dataset.opsi !== opsi) { sel.innerHTML = opsi; sel.dataset.opsi = opsi; }
  if (pilih && !kecs.includes(pilih)) pilih = '';
  sel.value = pilih; selK.value = pilihKelas; $('#kontrol').classList.remove('hide');
  const full = semuaKelas(pilihKelas);
  let list = full ? (pilih ? full.filter(r => r.kc === pilih) : full) : (pilih ? ((papan.kec[pilih] || {})[pilihKelas] || []) : ((papan.kls || {})[pilihKelas] || []));
  list = list.map((r, i) => ({ ...r, i }));            // simpan nomor peringkat asli sebelum difilter pencarian
  const q = norm(($('#cari') || {}).value || '');
  const total = list.length;
  if (q) list = list.filter(r => norm(r.n + ' ' + r.s).includes(q));
  const tampilList = list.slice(0, tampilN);
  const label = ['Juara 1', 'Juara 2', 'Juara 3', 'Harapan 1'];
  $('#list').innerHTML = !tampilList.length ? `<p class="center" style="opacity:.75;padding:40px 0">${q ? 'Tidak ditemukan.' : 'Belum ada peserta kelas ini yang mengumpulkan.'}</p>` :
    tampilList.map(s => { const i = s.i; return `<div class="lb-row ${pilih && i < 4 && s.sk > 0 ? 'r' + (i + 1) : ''}">
      <span class="rk">${pilih && i < 4 && s.sk > 0 ? medali(i) : i + 1}</span>
      <span class="nm"><b>${esc(s.n)}</b><small>${pilih && i < 4 ? `<em class="pred">${label[i]}</em> · ` : ''}Kelas ${esc(s.k)} · ${esc(s.s)}${pilih ? '' : ' · Kec. ' + esc(s.kc)}${s.d != null ? ' · ' + fmtTime(s.d) : ''}</small></span>
      <span class="pr">${s.b} benar</span>
      <span class="sk">${s.sk}</span></div>`; }).join('');
  const jml = $('#jml'), more = $('#more');
  if (jml) jml.textContent = list.length ? `Menampilkan ${tampilList.length} dari ${list.length}${q ? ' hasil pencarian' : ' peserta'}${full ? '' : ' (ringkasan)'}` : '';
  if (more) more.classList.toggle('hide', tampilList.length >= list.length);
  timer();
}
document.addEventListener('change', e => { if (e.target.id === 'selKec') { pilih = e.target.value; tampilN = 100; render(); } else if (e.target.id === 'selKelas') { pilihKelas = e.target.value; tampilN = 100; render(); muatSemua(pilihKelas); } });
document.addEventListener('input', e => { if (e.target.id === 'cari') { tampilN = 100; render(); } });
document.addEventListener('click', e => { if (e.target.id === 'more') { tampilN += 200; render(); } });
