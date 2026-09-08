# DATUK — Dashboard Pagu & Realisasi (versi Next.js/Vercel)

Versi tulis-ulang dari dashboard Streamlit asli (`dicky3x/pro1`), memakai Next.js
(App Router) supaya bisa dideploy langsung ke **Vercel**.

## Cakupan versi ini

✅ Sudah ada (semua sudah dites lulus build & smoke-test API):
- Login berbasis kode satker (username = password = kode satker 6 digit), atau login super user
- **Dashboard Utama** (`/`) — Pagu & Realisasi: KPI, grafik bulanan, komposisi jenis belanja,
  tren & proyeksi per jenis belanja + skor keyakinan, early warning
- **Dashboard Prioritas Presiden** (`/prioritas`) dan **Program Strategis** (`/strategis`) —
  filter kategori, KPI, grafik, perbandingan antar kategori, tabel rincian kegiatan/output
- **Dashboard Dana Transfer ke Daerah** (`/tkd`, khusus super user) — filter kabupaten/kota,
  KPI, komposisi jenis TKD, perbandingan antar wilayah
- **Dashboard Satker Dekon & TP** (`/dekon-tp`) — saat ini menampilkan info "belum tersedia"
  karena kolom `KEWENANGAN` memang tidak ada di `data/pagu_realisasi.csv.gz` saat ini
  (sama seperti perilaku asli Streamlit-nya)
- **Upload Dataset** (`/upload`, khusus super user) — upload CSV/TSV bebas + tanya AI
  tentang isinya (lihat catatan keamanan format file di bawah)
- Chat AI (Groq) dengan tool-calling pencarian tematik, ada di semua dashboard di atas
  (kecuali Dekon & TP, dan Upload yang punya tool analisisnya sendiri)
- Navigasi atas (`components/NavBar.tsx`) yang otomatis menyembunyikan menu khusus super user

🚧 Masih di luar cakupan:
- Integrasi Supabase (data dibaca langsung dari file CSV yang dibundel di repo, sama seperti
  perilaku default aplikasi Streamlit aslinya)
- Upload Excel (.xlsx) — lihat catatan keamanan di bawah

### Catatan jujur soal proyeksi & early warning

`forecasting.py` di repo asli ~1500 baris dengan fallback berjenjang (ke "satker sejenis"),
penyesuaian kebijakan manual, dan pemodelan yang jauh lebih detail. Versi di sini
(`lib/projection.ts`) mempertahankan **prinsip intinya** — rata-rata tertimbang pola bulanan
historis × pagu tahun berjalan, dengan bobot per tahun (50%/25%/12.5%/6.25%/6.25% untuk
tahun ke-1 s.d. ke-5, sama seperti `BOBOT_TAHUN` di `common.py` asli) — tapi disederhanakan:
tidak ada fallback ke "satker sejenis" maupun penyesuaian kebijakan manual, dan skor
keyakinan dihitung dari koefisien variasi pola historis (bukan metode asli yang lebih detail).
Untuk satker dengan histori data lengkap hasilnya harusnya dekat dengan versi asli; untuk
kasus tepi (data kosong, satker baru, dsb.) hasilnya bisa berbeda. Kalau akurasi proyeksi ini
krusial, sebaiknya diaudit lebih lanjut sebelum dipakai untuk pengambilan keputusan resmi.
Early warning juga versi sederhana (2 sinyal) dibanding versi asli.

Dashboard Prioritas Presiden/Program Strategis/TKD datanya cuma tersedia 1 tahun di sumber
saat ini, jadi proyeksinya otomatis fallback ke "rerata bulan berjalan × 12" (sama seperti
perilaku asli saat histori kosong).

Sudah diverifikasi: angka KPI (Pagu, Realisasi, Sisa Pagu, Blokir) dashboard utama cocok
persis dengan hasil agregasi pandas atas data sumber yang sama.

### Catatan keamanan soal upload dataset

Fitur upload (`/upload`) **sengaja hanya menerima CSV/TSV**, bukan Excel (.xlsx) seperti versi
Streamlit asli. Alasannya: satu-satunya library parsing Excel yang tersedia untuk Node.js/npm
(`xlsx`/SheetJS) punya kerentanan keamanan yang belum ada perbaikannya di rilis npm-nya
(prototype pollution & ReDoS — lihat GHSA-4r6h-8v6p-xvw6 dan GHSA-5pgg-2g8v-p4x9), dan ini
persis kerentanan yang jadi relevan saat memparsing file upload dari pengguna. Daripada
menyertakan dependency berisiko itu, versi ini membatasi ke CSV/TSV (diparse dengan
`csv-parse`, tidak ada laporan kerentanan serupa). Kalau kebutuhan Excel ini krusial,
pertimbangkan memakai versi SheetJS resmi dari CDN mereka (bukan npm) sesuai rekomendasi
SheetJS sendiri, atau proses konversi ke CSV di sisi klien sebelum upload.

Tool AI untuk analisis dataset upload (`analisis_dataset` di `app/api/chat-dataset/route.ts`)
memakai filter & agregasi dengan whitelist operator/fungsi (bukan `eval`/`exec` bebas), sama
prinsipnya dengan `_analisis_dataset_builder()` di `common.py` asli.

**Arsitektur upload**: dataset yang diupload TIDAK disimpan permanen di server (server Next.js
di Vercel itu stateless). Alurnya: file diupload → diparse jadi JSON di `/api/upload-parse` →
hasilnya (baris + kolom) disimpan di memori browser (React state) → tiap pertanyaan chat
mengirim ulang datanya ke `/api/chat-dataset` untuk dianalisis. Cocok untuk file yang cukup
kecil (dibatasi maks 5MB / 20.000 baris di `app/api/upload-parse/route.ts` — ubah `MAX_BYTES`/
`MAX_ROWS` di sana kalau perlu batas lain), tapi berarti data tsb tidak persisten antar sesi.

## Struktur data

Data sumber tetap dibundel di repo, sama seperti aslinya:
- `data/pagu_realisasi.csv.gz` (~120rb baris) — dashboard utama, TKD, Dekon & TP
- `data/prioritas_presiden.csv.gz` (166 baris) — Prioritas Presiden
- `data/program_strategis.csv.gz` (407 baris) — Program Strategis

Saat `npm run build`, `scripts/prepare-data.mjs` otomatis menghasilkan:
- `data/aggregated.json` — agregat TAHUN×KDDEPT×KDSATKER×JENIS BELANJA (dashboard utama)
- `data/tkd.json` — agregat TAHUN×KABKOTA×JENIS BELANJA, khusus kode 61-66 (dashboard TKD)
- `data/prioritas.json`, `data/strategis.json` — hasil parse penuh (dataset kecil, tak perlu agregasi)

File CSV mentah (`pagu_realisasi.csv.gz`) tetap dipakai untuk fitur pencarian tematik chat AI
di dashboard utama (di-parse sekali & di-cache di memori server saat pertama kali dipanggil).

**Update data**: ganti file `.csv.gz` yang relevan (format kolom harus sama), lalu commit &
push — Vercel akan otomatis rebuild dan semua file JSON turunan ikut ter-generate ulang.

## Environment variables (set di Vercel → Project Settings → Environment Variables)

| Variable | Wajib? | Keterangan |
|---|---|---|
| `SESSION_SECRET` | **Wajib di production** | String rahasia acak (mis. `openssl rand -hex 32`) untuk menandatangani cookie sesi login. Kalau tidak di-set, aplikasi tetap jalan tapi memakai nilai default yang TIDAK aman. |
| `SUPERUSER_USERNAME` | Opsional | Default `kanwil04` |
| `SUPERUSER_PASSWORD` | Opsional | Default `admin` — **ganti ini di production** |
| `GROQ_API_KEY` | Opsional | Tanpa ini, semua fitur chat AI menampilkan pesan "belum aktif" tapi dashboard tetap jalan normal. Daftar gratis di https://console.groq.com |
| `GROQ_MODEL` | Opsional | Default `openai/gpt-oss-120b`. Cek model terbaru di https://console.groq.com/docs/models |

## Deploy ke Vercel

1. Push folder ini ke repo GitHub baru (lihat langkah git di bawah).
2. Buka https://vercel.com/new, import repo tsb.
3. Set environment variables di atas (minimal `SESSION_SECRET`, dan `SUPERUSER_PASSWORD`
   kalau mau ganti dari default).
4. Deploy. Vercel akan otomatis menjalankan `npm run build` (yang sudah termasuk
   `prepare-data.mjs`).

```bash
cd pagu-dashboard
git init
git add .
git commit -m "Initial commit: dashboard pagu realisasi (Next.js)"
git branch -M main
git remote add origin https://github.com/<username>/<nama-repo-baru>.git
git push -u origin main
```

## Jalankan di lokal

```bash
npm install
npm run build   # generate semua file data JSON + build Next.js
npm run start   # atau `npm run dev` untuk mode development
```

Buka http://localhost:3000. Login pakai `kanwil04` / `admin` (atau ganti lewat env var),
atau login pakai kode satker (mis. `450780` sebagai username & password sekaligus).

## Struktur proyek

```
app/
  page.tsx                    # Dashboard Utama
  prioritas/page.tsx          # Dashboard Prioritas Presiden
  strategis/page.tsx          # Dashboard Program Strategis
  tkd/page.tsx                # Dashboard Dana Transfer ke Daerah (super only)
  dekon-tp/page.tsx           # Dashboard Satker Dekon & TP (info "belum tersedia")
  upload/page.tsx             # Upload dataset + chat AI (super only)
  api/login|logout|session/   # Auth
  api/dashboard/route.ts      # Data dashboard utama
  api/kategori/route.ts       # Data Prioritas Presiden & Program Strategis (param ?dataset=)
  api/tkd/route.ts            # Data Dana Transfer ke Daerah
  api/chat/route.ts           # Chat AI (Groq) dashboard anggaran, param dataset= utama|prioritas|strategis|tkd
  api/upload-parse/route.ts   # Parse file CSV/TSV yang diupload (super only)
  api/chat-dataset/route.ts   # Chat AI utk dataset yang diupload (tool analisis_dataset)
lib/
  data.ts                     # Loader semua data agregat/kategori (cache di memori)
  search-data.ts              # Loader data detail lazy (pencarian tematik dashboard utama)
  search-generic.ts           # Pencarian tematik utk kategori & TKD (dataset kecil, in-memory)
  projection.ts               # Mesin proyeksi (per kategori & agregat)
  auth.ts                     # Session cookie login
  format.ts                   # Helper format Rupiah, kode satker, dst.
components/
  AuthGate.tsx, NavBar.tsx    # Login gate + navigasi bersama semua halaman
  KategoriDashboardPage.tsx   # Komponen dashboard dipakai bersama Prioritas & Strategis
  DatasetUpload.tsx           # UI upload dataset + chat
  KpiCard, Charts, ProjectionTable, EarlyWarning, ChatBox, LoginForm
scripts/prepare-data.mjs      # Semua agregasi CSV -> JSON, jalan otomatis saat `npm run build`
data/*.csv.gz                 # Data sumber (sama seperti repo asli)
```

## Keamanan (baca sebelum dipakai untuk data sensitif)

Skema login ini **sama sederhananya dengan versi Streamlit asli** — kode satker sebagai
username & password sekaligus, tanpa hashing password terpisah. Ini cocok untuk kebutuhan
internal ringan, tapi kalau dashboard ini akan diakses publik/luas, pertimbangkan menambah
lapisan keamanan tambahan (mis. rate-limiting login, autentikasi yang lebih kuat).

Lihat juga bagian "Catatan keamanan soal upload dataset" di atas soal keputusan untuk tidak
menyertakan parser Excel.
