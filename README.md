# DATUK — Dashboard Pagu & Realisasi (versi Next.js/Vercel)

Versi tulis-ulang dari dashboard Streamlit asli (`dicky3x/pro1`), memakai Next.js
(App Router) supaya bisa dideploy langsung ke **Vercel**.

## Cakupan versi ini

✅ Sudah ada:
- Login berbasis kode satker (username = password = kode satker 6 digit), atau login super user
- Dashboard Pagu & Realisasi: KPI, grafik bulanan, komposisi jenis belanja, tren & proyeksi
- Proyeksi akhir tahun per jenis belanja + skor keyakinan (versi disederhanakan, lihat catatan di bawah)
- Early warning sederhana (proyeksi melebihi pagu, lonjakan/perlambatan realisasi)
- Chat AI (Groq) dengan pencarian tematik lintas satker/kementerian/provinsi

🚧 Belum ada (di luar cakupan yang disepakati untuk versi pertama ini):
- Dashboard Prioritas Presiden, Program Strategis, Dana Transfer ke Daerah, Satker Dekon & TP
- Upload dataset + tanya-jawab AI atas file yang diupload
- Integrasi Supabase (data dibaca langsung dari file CSV yang dibundel di repo, sama seperti
  perilaku default aplikasi Streamlit aslinya)

### Catatan jujur soal proyeksi & early warning

`forecasting.py` di repo asli ~1500 baris dengan fallback berjenjang (ke "satker sejenis"),
penyesuaian kebijakan manual, dan pemodelan yang jauh lebih detail. Versi di sini
(`lib/projection.ts`) mempertahankan **prinsip intinya** (rata-rata tertimbang pola bulanan
historis × pagu tahun berjalan, tahun lebih baru berbobot lebih besar) tapi disederhanakan.
Untuk satker yang punya histori data lengkap, hasilnya harusnya dekat dengan versi asli;
untuk kasus tepi (data kosong, satker baru, dsb.) hasilnya bisa berbeda. Kalau akurasi
proyeksi ini krusial, sebaiknya diaudit lebih lanjut sebelum dipakai untuk pengambilan
keputusan resmi. Early warning juga versi sederhana (2 sinyal) dibanding versi asli.

Sudah diverifikasi: angka KPI (Pagu, Realisasi, Sisa Pagu, Blokir) dashboard ini cocok
persis dengan hasil agregasi pandas atas data sumber yang sama.

## Struktur data

Data sumber (`data/pagu_realisasi.csv.gz`, ~120rb baris) tetap dibundel di repo, sama
seperti aslinya. Saat `npm run build`, skrip `scripts/prepare-data.mjs` otomatis membuat
`data/aggregated.json` (data teragregasi per satker/tahun/jenis belanja, ~3MB) yang dipakai
dashboard supaya cepat. File CSV mentah tetap dipakai untuk fitur pencarian tematik di chat
AI (di-parse sekali & di-cache di memori server saat pertama kali dipanggil).

**Update data**: ganti `data/pagu_realisasi.csv.gz` dengan file baru (format kolom harus
sama), lalu commit & push — Vercel akan otomatis rebuild dan `aggregated.json` ikut
ter-generate ulang.

## Environment variables (set di Vercel → Project Settings → Environment Variables)

| Variable | Wajib? | Keterangan |
|---|---|---|
| `SESSION_SECRET` | **Wajib di production** | String rahasia acak (mis. `openssl rand -hex 32`) untuk menandatangani cookie sesi login. Kalau tidak di-set, aplikasi tetap jalan tapi memakai nilai default yang TIDAK aman. |
| `SUPERUSER_USERNAME` | Opsional | Default `kanwil04` |
| `SUPERUSER_PASSWORD` | Opsional | Default `admin` — **ganti ini di production** |
| `GROQ_API_KEY` | Opsional | Tanpa ini, chat AI menampilkan pesan "belum aktif" tapi dashboard tetap jalan normal. Daftar gratis di https://console.groq.com |
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
npm run build   # generate data/aggregated.json + build Next.js
npm run start   # atau `npm run dev` untuk mode development
```

Buka http://localhost:3000. Login pakai `kanwil04` / `admin` (atau ganti lewat env var),
atau login pakai kode satker (mis. `450780` sebagai username & password sekaligus).

## Struktur proyek

```
app/
  page.tsx                 # Halaman dashboard utama (client component)
  api/login/route.ts       # Login
  api/logout/route.ts      # Logout
  api/session/route.ts     # Cek status login
  api/dashboard/route.ts   # Data KPI, grafik, proyeksi (dari aggregated.json)
  api/chat/route.ts        # Chat AI (Groq) + tool-calling pencarian tematik
lib/
  data.ts                  # Loader data agregat (cache di memori)
  search-data.ts           # Loader data detail (lazy, utk pencarian tematik AI)
  projection.ts            # Mesin proyeksi (versi disederhanakan)
  auth.ts                  # Session cookie login
  format.ts                # Helper format Rupiah, kode satker, dst.
components/                # UI: KpiCard, Charts, ProjectionTable, EarlyWarning, ChatBox
scripts/prepare-data.mjs   # Agregasi CSV -> JSON, jalan otomatis saat `npm run build`
data/pagu_realisasi.csv.gz # Data sumber (sama seperti repo asli)
```

## Keamanan (baca sebelum dipakai untuk data sensitif)

Skema login ini **sama sederhananya dengan versi Streamlit asli** — kode satker sebagai
username & password sekaligus, tanpa hashing password terpisah. Ini cocok untuk kebutuhan
internal ringan, tapi kalau dashboard ini akan diakses publik/luas, pertimbangkan menambah
lapisan keamanan tambahan (mis. rate-limiting login, autentikasi yang lebih kuat).
