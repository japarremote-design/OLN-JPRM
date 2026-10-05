// 30 soal contoh Literasi (1–15) & Numerasi (16–30) tingkat SD
// t = teks soal, o = 4 opsi A–D, k = indeks jawaban benar (0 = A, 1 = B, 2 = C, 3 = D)
const BACA_SURAMADU = 'Bacalah teks berikut!\n"Jembatan Suramadu diresmikan pada tahun 2009. Jembatan ini menghubungkan Kota Surabaya dengan Kabupaten Bangkalan. Sejak ada jembatan ini, perjalanan ke Pulau Madura menjadi lebih cepat."\n\n';
const BACA_RINA = 'Bacalah teks berikut!\n"Setiap pagi Rina menyiram tanaman di halaman rumahnya. Setiap minggu ia juga memberi pupuk. Karena dirawat dengan baik, tanaman Rina tumbuh subur dan berbunga indah."\n\n';
const BACA_PENGUMUMAN = 'Bacalah pengumuman berikut!\n"Diberitahukan kepada seluruh siswa kelas 5 bahwa kerja bakti akan diadakan pada hari Sabtu pukul 07.00 di halaman sekolah. Setiap siswa diharap membawa sapu."\n\n';
const BACA_KARAPAN = 'Bacalah teks berikut!\n"Karapan sapi adalah lomba pacuan sapi khas Madura. Sepasang sapi menarik kereta kayu yang dinaiki seorang joki. Lomba ini biasanya diadakan setelah musim panen."\n\n';

const SOAL_CONTOH = [
  // ---------- LITERASI ----------
  { t: BACA_SURAMADU + 'Berdasarkan teks, Jembatan Suramadu menghubungkan ...', o: ['Surabaya dan Sampang', 'Surabaya dan Bangkalan', 'Gresik dan Bangkalan', 'Surabaya dan Sumenep'], k: 1 },
  { t: BACA_SURAMADU + 'Manfaat Jembatan Suramadu menurut teks adalah ...', o: ['Perjalanan ke Pulau Madura menjadi lebih cepat', 'Harga barang di Madura menjadi murah', 'Jumlah kapal di Madura bertambah', 'Pulau Madura menjadi lebih luas'], k: 0 },
  { t: BACA_RINA + 'Sifat Rina yang tergambar dalam teks adalah ...', o: ['Malas', 'Sombong', 'Rajin', 'Pemarah'], k: 2 },
  { t: BACA_RINA + 'Mengapa tanaman Rina tumbuh subur?', o: ['Karena ditanam di dalam rumah', 'Karena jarang disiram', 'Karena dibeli di pasar', 'Karena dirawat dengan baik'], k: 3 },
  { t: BACA_PENGUMUMAN + 'Kapan kerja bakti dilaksanakan?', o: ['Jumat pukul 07.00', 'Sabtu pukul 09.00', 'Sabtu pukul 07.00', 'Minggu pukul 07.00'], k: 2 },
  { t: BACA_PENGUMUMAN + 'Barang yang harus dibawa siswa adalah ...', o: ['Sapu', 'Ember', 'Cangkul', 'Kain lap'], k: 0 },
  { t: BACA_KARAPAN + 'Siapa yang menaiki kereta kayu pada karapan sapi?', o: ['Petani', 'Joki', 'Penonton', 'Juri'], k: 1 },
  { t: BACA_KARAPAN + 'Kapan karapan sapi biasanya diadakan?', o: ['Sebelum musim tanam', 'Saat musim hujan', 'Setiap hari Minggu', 'Setelah musim panen'], k: 3 },
  { t: 'Lawan kata (antonim) dari "rajin" adalah ...', o: ['Malas', 'Tekun', 'Giat', 'Pandai'], k: 0 },
  { t: 'Persamaan kata (sinonim) dari "pandai" adalah ...', o: ['Bodoh', 'Pintar', 'Lambat', 'Malas'], k: 1 },
  { t: 'Penulisan kalimat yang benar adalah ...', o: ['kami berlibur ke Bangkalan.', 'Kami berlibur ke bangkalan.', 'Kami berlibur ke Bangkalan.', 'Kami Berlibur Ke Bangkalan.'], k: 2 },
  { t: 'Penulisan kata baku yang benar adalah ...', o: ['Apotik', 'Nasehat', 'Aktip', 'Apotek'], k: 3 },
  { t: 'Makna peribahasa "Rajin pangkal pandai" adalah ...', o: ['Orang yang rajin belajar akan menjadi pandai', 'Orang pandai tidak perlu rajin', 'Orang rajin selalu kaya', 'Orang malas pasti bodoh'], k: 0 },
  { t: 'Kata yang tepat untuk melengkapi kalimat berikut adalah ...\n"Ibu sedang ... nasi di dapur."', o: ['dimasak', 'memasak', 'termasak', 'masakan'], k: 1 },
  { t: 'Tanda baca yang tepat di akhir kalimat "Di mana rumahmu" adalah ...', o: ['Titik (.)', 'Koma (,)', 'Tanda tanya (?)', 'Tanda seru (!)'], k: 2 },
  // ---------- NUMERASI ----------
  { t: 'Hasil dari 345 + 278 adalah ...', o: ['613', '623', '523', '633'], k: 1 },
  { t: 'Hasil dari 1.000 − 456 adalah ...', o: ['544', '554', '644', '456'], k: 0 },
  { t: 'Hasil dari 24 × 15 adalah ...', o: ['340', '350', '370', '360'], k: 3 },
  { t: 'Hasil dari 144 : 12 adalah ...', o: ['11', '14', '12', '13'], k: 2 },
  { t: 'Ani membeli 3 buku dengan harga Rp4.500 per buku. Ani membayar dengan uang Rp20.000. Uang kembalian Ani adalah ...', o: ['Rp5.500', 'Rp6.500', 'Rp7.500', 'Rp13.500'], k: 1 },
  { t: 'KPK dari 4 dan 6 adalah ...', o: ['12', '24', '2', '10'], k: 0 },
  { t: 'FPB dari 18 dan 24 adalah ...', o: ['3', '4', '12', '6'], k: 3 },
  { t: 'Hasil dari ½ + ¼ adalah ...', o: ['²⁄₆', '¾', '²⁄₄', '⅓'], k: 1 },
  { t: 'Sebuah persegi memiliki panjang sisi 7 cm. Keliling persegi tersebut adalah ...', o: ['14 cm', '21 cm', '28 cm', '49 cm'], k: 2 },
  { t: 'Sebuah persegi panjang memiliki panjang 8 cm dan lebar 5 cm. Luasnya adalah ...', o: ['26 cm²', '13 cm²', '45 cm²', '40 cm²'], k: 3 },
  { t: '2,5 km sama dengan ... m', o: ['2.500', '250', '25', '25.000'], k: 0 },
  { t: 'Budi berangkat ke sekolah pukul 07.15. Perjalanan memerlukan waktu 45 menit. Budi tiba di sekolah pukul ...', o: ['07.45', '08.00', '08.15', '07.60'], k: 1 },
  { t: 'Nilai ulangan Siti adalah 7, 8, dan 9. Rata-rata nilai Siti adalah ...', o: ['7', '9', '8', '24'], k: 2 },
  { t: '25% dari 80 adalah ...', o: ['25', '40', '16', '20'], k: 3 },
  { t: 'Pada tahun 2026 Kabupaten Bangkalan merayakan hari jadi yang ke-495. Bangkalan berdiri pada tahun ...', o: ['1531', '1521', '1541', '1631'], k: 0 }
];
