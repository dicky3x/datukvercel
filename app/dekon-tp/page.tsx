"use client";

import AuthGate from "@/components/AuthGate";

export default function Page() {
  return (
    <AuthGate>
      {() => (
        <div className="max-w-3xl mx-auto p-8">
          <h1 className="text-2xl font-semibold mb-4">🏢 Dashboard Satker Dekonsentrasi &amp; Tugas Pembantuan</h1>
          <div className="bg-sky-50 text-sky-800 rounded-md p-4 text-sm leading-relaxed">
            Kolom <b>kewenangan</b> (Kantor Pusat/Kantor Daerah/Dekonsentrasi/Tugas Pembantuan/Urusan
            Bersama) belum tersedia di data saat ini, jadi halaman ini belum bisa menampilkan daftar
            satker Dekonsentrasi &amp; Tugas Pembantuan. Untuk mengaktifkan halaman ini, regenerasi{" "}
            <code>data/pagu_realisasi.csv.gz</code> dari file sumber yang memuat kolom kewenangan, lalu
            jalankan ulang <code>npm run build</code> (skrip <code>scripts/prepare-data.mjs</code> akan
            otomatis menyertakan kolom itu kalau tersedia di sumbernya).
          </div>
        </div>
      )}
    </AuthGate>
  );
}
