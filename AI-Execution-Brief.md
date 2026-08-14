# AI Execution Brief — Web App Parsing Data ICONNET

Gunakan bersama `PRD.md` dan `rules.md`. File ini adalah urutan eksekusi konkret untuk AI IDE (Google Antigravity).

## Tujuan Singkat
Bangun web app 2 halaman (React + Tailwind) yang mem-parsing data monitoring aset ICONNET (paste teks atau upload excel) menjadi tabel terstruktur FAT → ONT beserta rekap status bermasalah.

## Urutan Eksekusi

### Step 1 — Setup Project
- Buat struktur file native (lihat `rules.md`): `index.html`, `upload.html`, `/css`, `/js`
- Load dependency lewat CDN di HTML: SheetJS (`xlsx`), `jszip`, `file-saver` — tidak perlu `npm install` / build tool
- Pastikan struktur file bisa langsung di-deploy ke **GitHub Pages** (push ke repo, aktifkan Pages dari branch, tidak ada build step)

### Step 2 — Implementasi `parser.js`
- Fungsi `parseRawRows(rows: string[][]) -> ParsedAsset[]`
- Input: array of array of string (baris x kolom), sudah sama baik dari hasil split teks paste maupun hasil baca excel
- Terapkan logika hierarki FAT → ONT sesuai `rules.md` section "Aturan Parsing"
- Output sesuai skema di `PRD.md` section 5.3

### Step 3 — Implementasi `classifier.js`
- Fungsi `classifyValue(raw: string) -> { category, isProblem }`
- Terapkan tabel kategori di `PRD.md` section 5.2, termasuk alias/typo yang disebut di `rules.md`
- Ambang batas redaman sebagai konstanta yang bisa diubah

### Step 4 — Halaman 1: Paste Teks
- Textarea input + input field "Prefix ID" (default `SPLT_`)
- On submit: split teks jadi rows (newline → tab), lempar ke `parseRawRows(rows, prefix)`
- Render hasil pakai `render.js`, sediakan tombol "Copy" dan "Download .md"

### Step 5 — Halaman 2: Upload Excel (Multi-Sheet)
- File input + input field "Prefix ID" (default `SPLT_`, dipakai untuk semua sheet)
- Baca file pakai `xlsx` (SheetJS)
- Loop **setiap sheet** dalam workbook → convert masing-masing jadi array of array → lempar ke `parseRawRows(rows, prefix)` yang sama
- Render hasil per sheet (tab/section terpisah di preview), masing-masing dengan tombol "Copy" dan "Download .md"
- Generate 1 file `.md` per sheet (nama file = nama sheet), sediakan tombol download per file dan tombol "Download Semua (.zip)" (pakai `jszip` + `file-saver`)

### Step 6 — Komponen Tampilan (Vanilla JS, 2 Mode)
- `render.js`: cek dulu apakah dataset punya data check (`Math.max(...checks.length)` > 0)
  - **Mode A (ada check)**: render tabel dengan kolom FAT ID, ONT ID, Check 1..N (dinamis sesuai data), Status Risk, dengan color-coding
  - **Mode B (tidak ada check, contoh: Adisucipto.xlsx)**: render **1 kolom saja** — kode FAT sebagai baris grup (visual beda), kode ONT di bawahnya sebagai baris biasa, TIDAK ada kolom "FAT ID"/"ONT ID" terpisah
- `render.js` render Summary Panel HANYA di Mode A, di-skip total di Mode B
- `export.js`: tiga fungsi —
  - `generateMarkdown(parsedSheet) -> string` untuk isi file `.md` (ikut Mode A/B yang sama)
  - `generateTSV(parsedSheet) -> string` untuk tombol Copy (ikut Mode A/B yang sama — Mode B menghasilkan TSV 1 kolom)

### Step 7 — Testing Manual
- Uji pakai contoh data mentah (akan disediakan terpisah oleh user) untuk pastikan hierarki FAT-ONT dan klasifikasi status terbaca benar, termasuk kasus typo (`los`, `of`, `susspend`) dan trailing whitespace

## Definition of Done (MVP)
- [ ] User bisa paste teks di Halaman 1 dan langsung lihat tabel + rekap
- [ ] User bisa upload file excel di Halaman 2 dan langsung lihat tabel + rekap per sheet (skema sama dengan Halaman 1)
- [ ] User bisa custom prefix ID pencarian (default `SPLT_`) di kedua halaman
- [ ] Setiap sheet di file upload menghasilkan 1 file `.md` terpisah, bisa didownload satu-satu atau sekaligus (.zip)
- [ ] Hasil parsing (tiap sheet, dan Halaman 1) bisa di-copy ke clipboard
- [ ] Klasifikasi status menangani semua kategori di PRD (termasuk alias/typo), nilai angka redaman ditampilkan netral tanpa judge otomatis
- [ ] Dataset tanpa data check (contoh: Adisucipto.xlsx) tampil sebagai list 1 kolom (kode FAT + ONT tersusun sesuai grup), BUKAN tabel FAT ID/ONT ID terpisah
- [ ] Tidak ada crash pada baris/sheet dengan kolom kosong/tidak lengkap
- [ ] Seluruh aplikasi jalan sebagai static file (HTML/CSS/JS murni) tanpa build step, siap deploy langsung ke GitHub Pages

## Belum Termasuk MVP (Jangan Dikerjakan Dulu)
- Export CSV/JSON
- Filter/search
- Autentikasi & backend/database
