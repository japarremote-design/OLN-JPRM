// Tombol kedip "Pasang" (PWA) di pojok kanan atas header. Dipisah agar common.js (berisi config Firebase) tidak perlu diubah.
const IKON_PASANG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M6 11l6 6 6-6M5 21h14"/></svg>';
let promptPasang = null;
const sudahTerpasang = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptPasang = e; });
window.addEventListener('appinstalled', () => { const b = document.getElementById('btnPasang'); if (b) b.hidden = true; });
function pasangUI() {
  const b = document.getElementById('btnPasang'); if (!b || sudahTerpasang()) return;
  b.hidden = false;
  b.onclick = async () => {
    if (promptPasang) { promptPasang.prompt(); try { await promptPasang.userChoice; } catch (e) {} promptPasang = null; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast(ios ? 'Ketuk tombol Bagikan lalu pilih "Tambah ke Layar Utama"' : 'Ketuk menu ⋮ di pojok kanan atas, lalu pilih "Instal aplikasi" / "Tambahkan ke layar utama"');
  };
}
const _buatHeader = buatHeader;
buatHeader = function (label) {
  _buatHeader(label);
  const inn = document.querySelector('#hdr .in'); if (!inn) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'btnPasang'; b.className = 'pasang'; b.hidden = true; b.innerHTML = IKON_PASANG + ' Pasang';
  inn.appendChild(b); pasangUI();
};
