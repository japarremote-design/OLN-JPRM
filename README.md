# Olimpiade Literasi dan Numerasi Tingkat SD
Dalam rangka Hari Jadi Bangkalan ke-495 · Penyelenggara: Jawa Pos Radar Madura

Aplikasi olimpiade online pilihan ganda (30 soal: 15 literasi + 15 numerasi) untuk ±5.000 peserta serentak dari HP Android.
**Gratis:** hosting Vercel (Hobby) + Firebase Firestore (paket Spark).

| Halaman | Untuk | Alamat |
|---|---|---|
| `index.html` | Peserta (HP / APK) | `https://NAMA.vercel.app/` |
| `admin.html` | Panitia: soal, mulai/akhiri, hasil | `https://NAMA.vercel.app/admin.html` |
| `papan.html` | Papan skor live (proyektor) | `https://NAMA.vercel.app/papan.html` |

## Fitur
- 30 soal contoh tingkat SD (literasi & numerasi) siap pakai, tambah/edit/hapus, impor CSV/JSON, ekspor JSON
- Timer **per lomba** (bebas pindah soal) atau **per soal** (otomatis lanjut)
- Acak urutan soal & opsi per peserta, jawaban terkunci setelah dipilih
- Papan skor real-time (Top 100), hasil lengkap + unduh CSV
- Catatan berapa kali peserta keluar dari aplikasi
- Tahan sinyal putus: jawaban tersimpan di HP, aplikasi ditutup/dibuka lagi tetap lanjut
- Kunci jawaban tidak pernah dikirim ke HP peserta; soal tidak bisa diintip sebelum dimulai

## Kenapa desainnya begini (5.000 peserta, gratis)
- Realtime Database gratis hanya 100 koneksi → dipakai **Firestore** (tanpa batas koneksi).
- Kuota gratis Firestore per hari: 50.000 baca, 20.000 tulis. Jawaban disimpan di HP dan **dikirim sekali** saat selesai.
- Peserta tanpa login (login anonim Firebase dibatasi ±100 akun/jam per IP — satu sekolah bisa kena).
- Perkiraan pemakaian 1 lomba 5.000 peserta: ±25.000–30.000 baca, ±5.500 tulis → masih di bawah kuota.

> ⚠️ Kuota harian Firestore reset tiap tengah malam waktu Pasifik = **pukul 14.00 WIB**. Jangan uji coba besar-besaran di hari yang sama sebelum lomba.
> 💡 Untuk jaga-jaga, aktifkan paket **Blaze** (tetap dapat kuota gratis yang sama; kelebihan dibayar per pemakaian, untuk 5.000 peserta hanya hitungan sen dolar) dan pasang *budget alert*. Tanpa Blaze, bila kuota habis, kiriman jawaban akan ditolak.

## 1. Siapkan Firebase
1. Buka https://console.firebase.google.com → **Add project**.
2. **Build → Firestore Database → Create database** → mode *production*, lokasi `asia-southeast2 (Jakarta)`.
3. Tab **Rules** → tempel isi `firestore.rules` → **Publish**.
4. **Build → Authentication → Get started → Email/Password → Enable**. Tab **Users → Add user** (email & sandi admin). Salin **User UID**-nya.
5. Firestore → **Start collection** `admins` → Document ID = UID tadi → isi field `aktif` (boolean) `true`.
6. **Project settings → Your apps → Web (</>)** → daftarkan app → salin `firebaseConfig` ke `public/common.js` (baris paling atas).

## 2. Deploy ke Vercel
1. Upload folder ini ke GitHub (atau `vercel` CLI).
2. Vercel → **Add New Project** → pilih repo → Framework: **Other** → Deploy (folder `public` sudah diatur di `vercel.json`).

## 3. Jadikan APK Android (gratis)
1. Buka https://www.pwabuilder.com → masukkan alamat Vercel → **Start**.
2. **Package for stores → Android → Generate** → isi nama aplikasi & package (mis. `id.radarmadura.olimpiadesd`).
3. Unduh zip → di dalamnya ada file **.apk** siap install (simpan juga file *signing key*-nya untuk update berikutnya).
4. Bagikan APK ke sekolah. Peserta juga bisa langsung buka alamat web di Chrome tanpa install.

## 4. Hari-H
1. Admin login di `admin.html` → tab **Soal** → muat/impor 30 soal → tab **Kontrol** → atur waktu & poin → Simpan.
2. Peserta membuka aplikasi, isi nama & sekolah → layar *menunggu*.
3. Buka `papan.html` di proyektor.
4. Klik **Mulai Lomba** → soal muncul di semua HP. Waktu habis → jawaban terkirim otomatis.
5. **Biarkan halaman admin terbuka** di 1 perangkat (skor dihitung di sana). Jangan sering memuat ulang.
6. Setelah selesai: tab **Peserta & Hasil → Unduh hasil (CSV)**. Untuk lomba berikutnya: **Reset**.

Peringkat: skor tertinggi → benar terbanyak → waktu pengerjaan tercepat. Kiriman yang masuk >5 menit setelah waktu habis ditandai *terlambat*.

## Format impor CSV
```
soal,a,b,c,d,kunci
"Hasil dari 24 x 15 adalah ...",340,350,370,360,D
```
Bisa disiapkan di Excel / Google Sheets lalu *Save as CSV*.

## Saran sebelum lomba
- Lakukan **gladi bersih** dengan beberapa sekolah (mis. 50–100 HP) minimal sehari sebelumnya.
- Pastikan semua peserta sudah membuka aplikasi & mengisi data **sebelum** tombol Mulai ditekan.
