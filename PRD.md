# PRD — Web App Parsing Data Monitoring Aset ICONNET

## 1. Latar Belakang
User punya data monitoring jaringan (ICONNET/PLN Icon+) dalam bentuk excel yang berisi struktur hierarkis:
- **FAT/ODP** (kode format `SPLT_MTRF###`) sebagai node induk
- **ONT pelanggan** (kode format `SPLT_MTRA###`) sebagai node anak dari satu FAT
- Setiap ONT punya beberapa **kolom status/redaman** (hasil pengecekan pada waktu berbeda), isinya bisa berupa:
  - Nilai redaman optik (contoh: `-25.5`, `-24.9`) — angka dBm, biasanya negatif
  - Status teks: `loss`, `offline`, `deaktif` / `deaktivasi`, `suspend` (kadang dengan tanggal), `online`, `active`, `on`, `off`, `beda port`, `beda cluster`, `dying gasp`, `not found`, dsb
  - Sel kosong (tidak ada data)

Data ini awalnya berupa excel dengan **merged cell** untuk kolom FAT (satu FAT menaungi beberapa baris ONT), sehingga kalau di-copy-paste sebagai teks, hasilnya jadi baris-baris "pecah" yang perlu direkonstruksi hierarkinya.

## 2. Tujuan Aplikasi
Membuat web app 2 halaman, **native (vanilla HTML/CSS/JS, tanpa framework/build step)** karena akan **di-deploy ke GitHub Pages**, yang:
1. Menerima data mentah (paste teks ATAU upload file excel)
2. Mem-parsing & merekonstruksi hierarki FAT → ONT → status per pengecekan
3. Menampilkan hasil terstruktur (tabel rapi) + rekap ringkasan masalah
4. Menghasilkan file `.md` sebagai output akhir (lihat section 4a)

**Catatan asumsi**: dokumen PRD ini sendiri adalah dokumen perencanaan untuk **membangun** aplikasi di atas menggunakan Google Antigravity — bukan output dari aplikasinya.

## 3. Target Pengguna
Sanjaya (dan kemungkinan tim/rekan kerja) yang menangani monitoring & troubleshooting jaringan fiber ICONNET.

## 4. Struktur Halaman

### Halaman 1 — Paste Teks Excel
- Textarea besar untuk paste data mentah hasil copy dari excel (tab-separated)
- Input field "Prefix ID" (default: `SPLT_`) — bisa diubah user sesuai kebutuhan
- Tombol "Parse Data"
- Preview hasil parsing langsung di bawah (tabel + rekap), lengkap dengan tombol "Copy" dan "Download .md"

### Halaman 2 — Upload File Excel
- Input upload file `.xlsx` / `.xls`
- Input field "Prefix ID" (default: `SPLT_`) — sama seperti Halaman 1, dipakai untuk semua sheet dalam file tsb
- File bisa berisi **satu atau banyak sheet** — setiap sheet mewakili satu lokasi/site (contoh: sheet "Adisucipto", sheet "NTB", dst)
- Parsing dilakukan **per sheet secara independen** (setiap sheet punya hierarki FAT→ONT sendiri)
- Preview menampilkan hasil per sheet (misal dalam bentuk tab/section per sheet), dengan tabel + rekap yang sama seperti Halaman 1, masing-masing punya tombol "Copy" dan "Download .md"

> Kedua halaman menghasilkan struktur data parsing yang **sama** per unit (FAT→ONT), hanya beda sumber input dan Halaman 2 bisa punya banyak unit sekaligus (multi-sheet).

## 4a. Requirement Output Akhir (Halaman 2)
- **Setiap sheet diubah menjadi 1 file `.md` tersendiri** (bukan digabung jadi satu file besar)
- Nama file output mengikuti nama sheet (contoh: sheet `Adisucipto` → file `Adisucipto.md`)
- Isi tiap file: hasil parsing terstruktur (tabel FAT→ONT + rekap ringkasan) dalam format Markdown
- User bisa **download** tiap file satu-satu, atau download semua sekaligus dalam bentuk `.zip`
- User juga bisa **copy hasil parsing sebagai kolom (tab-separated / TSV)** ke clipboard (tombol "Copy") per sheet — di Mode A hasilnya multi-kolom (FAT ID, ONT ID, Check..., Status Risk), di Mode B hasilnya cuma 1 kolom (kode FAT + kode ONT tersusun sesuai grup) — supaya bisa langsung di-paste jadi kolom rapi di Excel/Spreadsheet sesuai struktur yang relevan. Berlaku juga untuk Halaman 1 (paste teks). Ini terpisah dari file `.md` yang didownload (isi file `.md` tetap format Markdown untuk dibaca manusia, ikut mode yang sama)

## 5. Logika Parsing (Inti Aplikasi)

### 5.1 Rekonstruksi Hierarki
- Aplikasi punya **input field "Prefix ID"** yang bisa di-custom oleh user, default-nya `SPLT_` — hanya cell yang isinya diawali prefix ini yang dianggap sebagai kode aset (FAT atau ONT)
- Baris yang isinya **hanya kode aset** (cocok prefix) TANPA data apapun di kolom-kolom lain = **FAT/parent baru**
- Baris yang isinya kode aset (cocok prefix) DENGAN data di kolom-kolom lain (status/redaman) = **ONT/child**, jadi anak dari FAT terakhir yang ditemukan
- Pembedaan FAT vs ONT ini **berbasis struktur baris** (ada data check di sampingnya atau tidak), **bukan** berdasarkan pola sub-kode seperti "MTRF" vs "MTRA" — supaya tetap bekerja walau format kode aset di data lain berbeda

### 5.2 Klasifikasi Nilai per Kolom Check
Setiap nilai di kolom check diklasifikasikan otomatis. **Nilai angka redaman (dBm) ditampilkan apa adanya sebagai informasi, TIDAK di-judge otomatis "bagus/buruk"** (tidak ada threshold) — hanya kata kunci status yang ditandai sebagai masalah:

| Kategori | Pola Deteksi | Ditandai "Bermasalah"? |
|---|---|---|
| **Nilai Redaman** | Angka desimal negatif (contoh `-25.5`, `-24.9`) | Tidak — tampil sebagai info saja |
| **Loss** | Teks mengandung "loss"/"los" | Ya |
| **Offline** | Teks mengandung "offline"/"of" | Ya |
| **Deaktif/Deaktivasi** | Teks mengandung "deak", "deaktif", "deaktivasi" | Ya |
| **Suspend** | Teks mengandung "suspend"/"susspend" (termasuk yang ada tanggal) | Ya |
| **Aktif/Online** | Teks "online", "active", "on" | Tidak |
| **Anomali Lain** | "dying gasp", "beda port", "beda cluster/fat", "not found", "pindah cluster", "??", dll | Ya (perlu dicek manual) |
| **Kosong** | Sel tidak ada isi | Tidak |

### 5.3 Output Terstruktur
Setiap baris ONT menjadi satu object:
```json
{
  "fat_id": "SPLT_MTRF027",
  "ont_id": "SPLT_MTRA247",
  "checks": [
    { "index": 1, "raw_value": "offline", "category": "offline" },
    { "index": 2, "raw_value": "-27.9", "category": "redaman_ok" }
  ],
  "has_problem": true
}
```

## 6. Tampilan Hasil (Preview)

Ada **2 mode tampilan**, dipilih otomatis berdasarkan ada/tidaknya data check di dataset:

### Mode A — Tabel Multi-Kolom (dataset punya data check)
1. **Tabel Terstruktur** — baris = ONT, kolom = FAT ID, ONT ID, lalu Check 1..N (color-coding: hijau=normal, merah=problem, abu=kosong/unknown), diikuti kolom Status Risk
   - Kolom bersifat dinamis mengikuti data: jumlah kolom "Check" yang ditampilkan HARUS sama dengan jumlah kolom check yang benar-benar ada di dataset tsb
2. **Rekap Ringkasan**: total FAT, total ONT, jumlah bermasalah vs normal, breakdown per kategori status, daftar FAT dengan ONT bermasalah terbanyak

### Mode B — List Sederhana Satu Kolom (dataset TIDAK punya data check sama sekali)
- Contoh kasus: `Adisucipto.xlsx` — cuma daftar kode, tanpa data status/check apapun
- **TIDAK ada pemisahan kolom "FAT ID" dan "ONT ID"** — outputnya **1 kolom saja**, isinya:
  - Kode FAT ditampilkan sebagai baris grup/judul (boleh dibedakan secara visual, misal bold atau warna beda)
  - Kode-kode ONT di bawahnya ditampilkan sebagai baris biasa dalam kolom yang sama, mengikuti urutan & pengelompokan seperti data asli
- Tidak ada Rekap Ringkasan di mode ini (karena tidak ada data status untuk direkap)
- Ini menjaga struktur output tetap sama persis dengan struktur input (1 kolom kode, dikelompokkan per FAT), sesuai data mentahnya

## 7. Fitur Fase 2 (Opsional, Belum Prioritas)
- Export hasil ke CSV/Excel/JSON
- Filter/search berdasarkan FAT ID, status, dll
- Riwayat parsing tersimpan (local storage / database)

## 8. Batasan (Out of Scope untuk MVP)
- Tidak ada autentikasi user
- Tidak ada integrasi API eksternal (ICONNET system, dsb)
- Tidak menangani multi-sheet excel kompleks di luar sheet pertama (kecuali diminta)

## 9. Hal yang Masih Perlu Dikonfirmasi User
1. Apakah data upload di Halaman 2 formatnya identik dengan contoh, atau ada sheet/kolom tambahan (header, nama pelanggan, dll) yang perlu ditangani
