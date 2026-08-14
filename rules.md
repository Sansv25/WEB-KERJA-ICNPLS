# Rules — Panduan Implementasi untuk Google Antigravity

## Stack yang Disarankan
- **Frontend**: **Native/Vanilla HTML + CSS + JavaScript** (tanpa framework, tanpa build tool) — karena akan di-deploy ke **GitHub Pages** (static hosting, tidak ada server/build step)
- Styling: CSS murni, atau Tailwind lewat **CDN** (`<script src="https://cdn.tailwindcss.com">`) kalau tetap mau utility-class tanpa build step
- **Parsing excel (upload file)**: gunakan library `xlsx` (SheetJS) lewat CDN — `<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>`
- **Generate & download banyak file (.zip)**: `jszip` + `file-saver` lewat CDN
- **Parsing teks (paste)**: parsing manual dengan split by newline (`\n`) lalu split by tab (`\t`) per baris — jangan pakai regex kompleks untuk split kolom, tab-separated sudah cukup
- Tidak perlu backend/server sama sekali — semua parsing & generate file dilakukan di client-side (browser), cocok untuk GitHub Pages

## Struktur Kode
- Pisahkan logika parsing ke dalam module/fungsi murni (pure function), terpisah dari komponen UI, supaya:
  - Bisa dipakai ulang di Halaman 1 (paste) dan Halaman 2 (upload) — sumber data beda, hasil parsing & tampilan sama
  - Mudah di-unit-test
- Struktur folder yang disarankan (native, tanpa build tool):
  ```
  /index.html          <- Halaman 1 (paste teks) & navigasi
  /upload.html         <- Halaman 2 (upload excel)
  /css
    style.css
  /js
    parser.js          <- logika inti: raw rows -> structured data
    classifier.js       <- logika klasifikasi status per cell
    render.js           <- render tabel & summary ke DOM
    export.js           <- generate .md per sheet + zip download
    paste-page.js        <- controller khusus Halaman 1
    upload-page.js        <- controller khusus Halaman 2
  ```
- Semua file JS di-load via `<script src="...">` biasa (tanpa modul bundler), gunakan `type="module"` kalau mau pakai ES module native di browser (didukung semua browser modern, aman untuk GitHub Pages)

## Aturan Render Output (2 Mode, Bukan Fixed)
- Hitung dulu jumlah maksimum kolom check yang benar-benar ada di data hasil parsing (`Math.max(...parsedRows.map(r => r.checks.length))`)
- **Kalau hasilnya > 0 (Mode A — Tabel)**: render tabel dinamis dengan kolom FAT ID, ONT ID, Check 1..N (sejumlah maksimum yang dihitung), Status Risk — generate header via JS, jangan hardcode "Check 1"/"Check 2" di HTML
- **Kalau hasilnya = 0 (Mode B — List Sederhana)**: **JANGAN** render sebagai tabel 2 kolom "FAT ID"/"ONT ID". Render sebagai **1 kolom saja**: baris kode FAT (ditandai visual beda, misal bold/background beda) diikuti baris-baris kode ONT di bawahnya sesuai urutan grup aslinya. Tidak ada kolom lain sama sekali di mode ini
- Logic pemilihan mode ini berlaku sama untuk: render preview di layar, generate isi file `.md`, dan generate TSV untuk tombol Copy — ketiganya harus konsisten ikut mode yang sama
- Skip Summary Panel sepenuhnya di Mode B (tidak ada data untuk direkap)

## Fitur Copy to Clipboard (Format TSV, Bukan Markdown)
- Tombol "Copy" **menyalin data dalam format tab-separated (TSV)** — antar kolom dipisah karakter tab (`\t`), antar baris dipisah newline (`\n`) — supaya begitu di-paste ke Excel/Google Sheets, datanya otomatis kepisah jadi kolom-kolom, bukan satu blok teks
- Baris pertama tetap header kolom sesuai mode yang aktif (Mode A: FAT ID, ONT ID, Check 1..N, Status Risk / Mode B: tanpa header kolom, langsung 1 kolom kode), diikuti baris data
- Gunakan `navigator.clipboard.writeText(tsvString)` untuk trigger copy
- Berikan feedback visual singkat setelah copy berhasil (contoh: teks tombol berubah jadi "Copied!" selama 1-2 detik)
- **Catatan**: fitur download tetap menghasilkan file `.md` (format Markdown table, untuk dibaca manusia) — hanya tombol "Copy" yang formatnya TSV, karena tujuannya beda (Copy = buat di-paste ke Excel, Download = buat dokumentasi/dibaca)

## Aturan Multi-Sheet (Halaman 2)
- Loop semua sheet di workbook (`workbook.SheetNames` dari SheetJS)
- Tiap sheet diparsing **independen** memakai fungsi parser yang sama (`parseRawRows`) — jangan gabungkan data antar sheet
- Hasil akhir per sheet di-generate sebagai **1 file `.md` terpisah**, nama file = nama sheet (sanitize karakter yang tidak valid untuk nama file, contoh: `Adisucipto` → `Adisucipto.md`)
- Untuk download banyak file `.md` sekaligus, bundling jadi `.zip` pakai `jszip` + trigger download pakai `file-saver` (keduanya lewat CDN)
- Sediakan juga opsi download satu-satu (tombol download per sheet di preview)

## Aturan Parsing (WAJIB diikuti sesuai PRD)
1. Prefix ID **dapat dikustomisasi user** lewat input field, default `SPLT_` — semua deteksi kode aset pakai `String.prototype.startsWith(prefix)`, jangan hardcode `SPLT_`
2. Baris yang kolom pertamanya cocok prefix DAN kolom sisanya kosong = FAT baru (parent)
3. Baris yang kolom pertamanya cocok prefix DAN ada isi di kolom lain = ONT (child dari FAT terakhir yang di-track)
4. **Jangan bedakan FAT vs ONT dari sub-pola kode** (seperti "MTRF" vs "MTRA") — pembedaan murni dari struktur baris (ada data check di sampingnya atau tidak), karena prefix/pola kode bisa berbeda-beda antar dataset user
5. Jangan asumsikan jumlah kolom check selalu sama — baca semua kolom yang ada di baris tsb sebagai array `checks[]` (jumlahnya memang bervariasi antar baris/dataset)
6. Klasifikasi status **case-insensitive** dan harus tangani typo umum yang ditemukan di data riil: `los` (bukan loss), `of` (bukan offline), `susspend` (bukan suspend) — buat daftar alias per kategori, jangan exact match saja
7. **Nilai angka (redaman dBm) TIDAK di-judge otomatis "bagus/buruk"** — tidak ada threshold, cukup ditampilkan sebagai info netral. Hanya kata kunci status (loss, offline, deaktif, suspend, dying gasp, dll) yang ditandai `isProblem: true`
8. Trim whitespace berlebih di setiap cell sebelum diklasifikasi (data riil banyak trailing space, contoh: `"-24.4  "`)

## Konvensi Kode
- Penamaan variabel & fungsi dalam Bahasa Inggris (standar coding), UI teks dalam Bahasa Indonesia
- Vanilla JS: gunakan `function` atau arrow function biasa, DOM manipulation langsung (`document.querySelector`, dst) — tidak perlu framework reactive
- State parsing hasil disimpan sebagai variabel JS biasa di scope module masing-masing halaman (tidak perlu state management library)
- Semua file harus bisa jalan langsung dibuka sebagai static file / di-deploy ke GitHub Pages tanpa proses build apapun

## Yang TIDAK Boleh Dilakukan
- Jangan hardcode ambang batas redaman tanpa menjadikannya konstanta yang mudah diubah (taruh di `config.js` atau di atas `classifier.js`)
- Jangan buat backend/database dulu sebelum MVP client-side selesai & disetujui
- Jangan overengineer dengan menambah fitur di luar PRD (export, auth, dll) tanpa konfirmasi
