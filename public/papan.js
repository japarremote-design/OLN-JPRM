// Papan skor: cukup membaca 1 dokumen ringkasan (publik/papan) yang diperbarui admin tiap ±5 detik
let cfg = {}, papan = {};
docConfig.onSnapshot(s => { cfg = s.data() || {}; $('#judul').textContent = cfg.judul || DEFAULT_JUDUL; render(); });
docPapan.onSnapshot(s => { papan = s.data() || {}; render(); });
setInterval(timer, 500);

function timer() {
  const el = $('#tmr'), st = cfg.status || 'menunggu';
  if (st === 'mulai' && tsMs(cfg.mulaiAt)) { const s = sisaWaktu(cfg); el.textContent = fmtTime(s); el.classList.toggle('warn', s < 30000); }
  else { el.textContent = st === 'selesai' ? 'SELESAI' : 'SIAP'; el.classList.remove('warn'); }
}
function render() {
  const st = cfg.status || 'menunggu';
  const p = $('#st'); p.className = 'pill ' + st; p.textContent = { menunggu: 'Menunggu', mulai: 'Berlangsung', selesai: 'Selesai' }[st];
  const list = papan.sesi === cfg.sesi ? (papan.top || []) : [];
  const total = papan.sesi === cfg.sesi ? (papan.total || 0) : 0;
  $('#info').textContent = `${total} peserta sudah mengumpulkan · ${cfg.jumlahSoal || 0} soal`;
  $('#list').innerHTML = !list.length ? '<p class="center" style="opacity:.6;padding:40px 0">Belum ada peserta yang mengumpulkan.</p>' :
    list.map((s, i) => `<div class="lb-row ${i < 3 && s.skor > 0 ? 'r' + (i + 1) : ''}">
      <span class="rk">${i < 3 && s.skor > 0 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
      <span class="nm"><b>${esc(s.nama)}</b><small>${esc(s.asal)}${s.durasiMs != null ? ' · ' + fmtTime(s.durasiMs) : ''}</small></span>
      <span class="pr">${s.benar}/${s.total} benar</span>
      <span class="sk">${s.skor}</span></div>`).join('');
  timer();
}
