// Papan skor publik. Hanya membaca 2 dokumen kecil (config/lomba & publik/papan) yang diperbarui admin.
buatHeader('Jawa Pos Radar Madura · Papan Skor Langsung');
let cfg = {}, papan = {}, pilih = '', pilihKelas = '3';

// Hemat kuota baca: ambil 2 dokumen kecil tiap 60 detik (bukan listener langsung)
async function muat() {
  try { const [c, p] = await Promise.all([docConfig.get(), docPapan.get()]); cfg = c.data() || {}; papan = p.data() || {}; setJudul(cfg.judul); render(); } catch (e) { /* coba lagi 60 dtk */ }
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
  const list = pilih ? ((papan.kec[pilih] || {})[pilihKelas] || []) : ((papan.kls || {})[pilihKelas] || []);
  const label = ['Juara 1', 'Juara 2', 'Juara 3', 'Harapan 1'];
  $('#list').innerHTML = !list.length ? '<p class="center" style="opacity:.75;padding:40px 0">Belum ada peserta kelas ini yang mengumpulkan.</p>' :
    list.map((s, i) => `<div class="lb-row ${pilih && i < 3 && s.sk > 0 ? 'r' + (i + 1) : ''}">
      <span class="rk">${pilih && i < 3 && s.sk > 0 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
      <span class="nm"><b>${esc(s.n)}</b><small>${pilih && i < 4 ? `<em class="pred">${label[i]}</em> · ` : ''}Kelas ${esc(s.k)} · ${esc(s.s)}${pilih ? '' : ' · Kec. ' + esc(s.kc)}${s.d != null ? ' · ' + fmtTime(s.d) : ''}</small></span>
      <span class="pr">${s.b} benar</span>
      <span class="sk">${s.sk}</span></div>`).join('');
  timer();
}
document.addEventListener('change', e => { if (e.target.id === 'selKec') { pilih = e.target.value; render(); } else if (e.target.id === 'selKelas') { pilihKelas = e.target.value; render(); } });
