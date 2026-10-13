# Olimpiade Literasi & Numerasi SD — Hari Jadi Bangkalan ke-495
Jawa Pos Radar Madura · dibuat oleh Qfaz Digital

PWA (bisa dipasang di Android/iPhone, opsional dibungkus jadi APK) + Firebase Firestore + Vercel.

## Alur lomba
- **Login peserta tanpa kode**: nama lengkap, kelas (3/4/5), kecamatan, sekolah (dropdown dari 613 SD / 18 kecamatan). Peserta yang belum ada di daftar panitia otomatis terdaftar. Nama dicocokkan tanpa peduli huruf besar/kecil, titik, atau spasi ganda.
- Soal tampil sesuai **kelas**; urutan soal **diacak per peserta**. Jawaban **boleh diganti** sampai menekan "Selesai & kumpulkan" (mode total waktu).
- Satu nama = satu HP = satu kali mengerjakan. HP rusak / salah kirim: Admin → Peserta/Hasil → **Reset**.
- Timer pribadi 60 menit (dijaga server). Hasil dihitung di perangkat admin (kunci jawaban tidak pernah dikirim ke HP peserta). Skor = benar × 2.
- **Papan skor** (`papan.html`): pilih kelas + kecamatan → Juara 1, 2, 3 dan Harapan 1.

## Jadwal & babak (Admin → Kontrol)
| Babak | Pengaturan |
|---|---|
| **Gladi** (H-2: 15 Okt & 24 Okt) | Babak = Gladi, centang "Tampilkan skor & waktu ke peserta". Soal: tab Soal → babak Gladi → "Muat 30 soal contoh". Selesai gladi: Peserta → **Bersihkan data gladi** |
| **Penyisihan** 17 Okt | Babak = Penyisihan, Jadwal = Jendela waktu (isi buka/tutup, default 08.00–11.00; gladi juga 08.00–11.00), Timer total 60 menit |
| **Final** 26 Okt | Tutup sesi penyisihan → Tab Finalis (kuota, "Tetapkan") → Sesi baru → Babak = Final, Jadwal = Serentak (atau jendela) → Buka |

Untuk tiap sesi: tab **Soal** (isi 6 set: penyisihan & final × kelas 3/4/5, plus gladi) → Kontrol → **Buka Sesi**. Sesi membuat 3 paket soal (satu per kelas).

## Soal
- `soal-siap-impor/penyisihan-kelas-3|4|5.xlsx` = 150 soal penyisihan dari file Word panitia (kunci sudah terisi; **jangan taruh folder ini di folder `public`**, berisi kunci).
- Tab Soal → pilih **Babak** dan **Kelas** → Impor (xlsx/csv/json) → ulangi untuk tiap kelas. Soal final belum ada: siapkan dengan format yang sama lalu impor ke babak Final.
- Format Excel: `Soal, Gambar Soal, A, Gambar A, … D, Gambar D, Kunci, Tabel` (Tabel: satu baris per baris tabel, sel dipisah `|`). Gambar: alamat https (Cloudinary).
- `tools/parse_soal.py file.docx out.json` = pengurai soal Word → JSON (butuh pandoc & python-docx) bila ada file Word baru.

## Peserta
- Tab Peserta → impor Excel `Nama Siswa, Kecamatan, Nama Sekolah, Kelas` (±2.000 terdaftar). Nama sekolah/kecamatan otomatis disamakan dengan daftar resmi. Boleh diimpor berkali-kali (tidak dobel).
- Pendaftaran mandiri bisa dimatikan (Kontrol → centang "Izinkan pendaftaran mandiri").
- Kelas di luar 3–5 ditolak.

## Setup (sekali)
1. **Firebase**: buat project → Firestore Database (production) → Authentication → Email/Password → buat 1 user admin.
2. Project settings → Web app → salin config ke `public/common.js` (`firebaseConfig`).
3. Firestore → **Rules** → tempel isi `firestore.rules` → Publish. Uji di *Rules Playground* (belum diuji di emulator resmi Firebase).
4. Koleksi `admins`: dokumen dengan **ID = UID admin** (lihat Authentication), isi bebas (`aktif: true`).
5. (Opsional gambar soal) Cloudinary → unsigned upload preset → isi `CLOUDINARY` di `common.js`.
6. **Vercel**: deploy folder ini (`vercel.json` memakai folder `public`).
7. `/admin.html` → login → impor soal → impor peserta.

## Kuota Firestore gratis (Spark: 50 ribu baca & 20 ribu tulis / hari, reset 14.00 WIB)
Sudah dihemat: ±6 baca & ±3 tulis per peserta (login 1, config 1, kunci HP 1, paket soal 1, kirim jawaban 2). 5.500 peserta ≈ 33 ribu baca + panel admin ±8 ribu; tulis ≈ 15 ribu. Muat tapi mepet — **ukur saat gladi** (Firebase Console → Firestore → Usage).
- Buka panel admin **sekali saja** dan jangan sering di-refresh (tiap buka membaca ulang semua jawaban).
- Matikan "Tampilkan papan skor" selama lomba; nyalakan setelah pengumuman. Papan memuat ulang tiap 60 detik.
- Klik **Buka Sesi** tepat saat jam mulai (ID paket soal baru diumumkan saat itu).
- Reset kuota jam 14.00 WIB: jendela penyisihan yang melewati jam itu (mis. 08.00–17.00) otomatis mendapat jatah dua hari.
- Cadangan: paket Blaze (butuh kartu) — jatah gratis tetap ada, kelebihan sangat murah.

## PWA vs APK
Utamakan **PWA** (buka link → "Tambahkan ke layar utama"). APK opsional: pwabuilder.com → URL Vercel → Package for Android.

## Catatan
- Warna mengikuti logo (biru `#0093DD`, oranye `#FFA60C`); logo RadarMadura.id di header menuju https://radarmadura.jawapos.com/ ; di bawahnya logo HUT Bangkalan 495, Pemkab Bangkalan, Dinas Pendidikan.
- Keamanan: tanpa kode, siapa pun bisa mengetik nama orang lain. Pencegahan: pengawasan guru/panitia, nama yang sudah mengirim tidak bisa dipakai lagi, admin dapat reset. Untuk final bisa ditambah kode.
- Uji otomatis (jsdom + simulasi Firestore & aturan): gladi, pendaftaran mandiri, impor 3 kelas × 50 soal, 600 peserta, penyisihan, papan juara, finalis, final — lulus semua.
