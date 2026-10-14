// Tombol kedip "Pasang" (PWA) di pojok kanan atas header. Dipisah agar common.js (berisi config Firebase) tidak perlu diubah.
const IKON_PASANG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M6 11l6 6 6-6M5 21h14"/></svg>';
let promptPasang = null;
const KUNCI = 'oln_terpasang';
const tandai = () => { try { localStorage.setItem(KUNCI, '1'); } catch (e) {} };
const sudahTandai = () => { try { return localStorage.getItem(KUNCI) === '1'; } catch (e) { return false; } };
const sudahTerpasang = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
if (sudahTerpasang()) tandai(); // dibuka dari ikon layar utama = sudah terpasang
function tampilTombol(ya) { const b = document.getElementById('btnPasang'); if (b) b.hidden = !ya; }
// Android/Chrome: tombol hanya muncul bila browser benar-benar menawarkan pasang (jadi hilang bila sudah terpasang)
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptPasang = e; if (!sudahTandai()) tampilTombol(true); });
window.addEventListener('appinstalled', () => { tandai(); promptPasang = null; tampilTombol(false); });
function pasangUI() {
  const b = document.getElementById('btnPasang'); if (!b) return;
  if (sudahTerpasang() || sudahTandai()) return;
  if (promptPasang || (ios && !sudahTerpasang())) b.hidden = false; // iPhone tidak punya event, tampil sekali sampai diketuk
  b.onclick = async () => {
    if (promptPasang) {
      promptPasang.prompt();
      try { const r = await promptPasang.userChoice; if (r && r.outcome === 'accepted') { tandai(); tampilTombol(false); } } catch (e) {}
      promptPasang = null; return;
    }
    toast('Ketuk tombol Bagikan lalu pilih "Tambah ke Layar Utama"'); tandai(); tampilTombol(false);
  };
}
const _buatHeader = buatHeader;
buatHeader = function (label) {
  _buatHeader(label);
  const inn = document.querySelector('#hdr .in'); if (!inn) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'btnPasang'; b.className = 'pasang'; b.hidden = true; b.innerHTML = IKON_PASANG + ' Pasang';
  inn.appendChild(b); pasangUI();
};

// Kredit pembuat di footer (kecil). Disembunyikan saat ujian berlangsung (lihat style.css: body.ujian .kredit).
(function () {
  const pasangKredit = () => {
    if (document.querySelector('.kredit')) return;
    const f = document.createElement('footer'); f.className = 'kredit';
    f.innerHTML = 'Powered by <a href="https://www.qfazdigital.my.id" target="_blank" rel="noopener"><img src="qfaz-logo.png" alt="" width="22" height="22" onerror="this.remove()"> <b>Qfaz Digital</b></a>';
    document.body.appendChild(f);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasangKredit); else pasangKredit();
})();
