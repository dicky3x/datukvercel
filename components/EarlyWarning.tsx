type Peringatan = { tingkat: string; jenis: string; kategori: string; alasan: string };

const WARNA: Record<string, string> = { Tinggi: "🔴", Sedang: "🟡", Rendah: "🟢" };

export default function EarlyWarning({
  skorRisiko,
  kategoriRisiko,
  peringatan,
}: {
  skorRisiko: number;
  kategoriRisiko: string;
  peringatan: Peringatan[];
}) {
  return (
    <div>
      <p className="font-medium mb-2">
        Skor Risiko: {skorRisiko}/100 — {WARNA[kategoriRisiko] || ""} {kategoriRisiko}
      </p>
      {peringatan.length === 0 ? (
        <div className="bg-emerald-50 text-emerald-700 text-sm rounded-md p-3">
          Tidak ada sinyal risiko yang terdeteksi untuk entitas ini.
        </div>
      ) : (
        <div className="space-y-2">
          {peringatan.map((p, i) => (
            <details key={i} open className="border rounded-md p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                {WARNA[p.tingkat] || "⚪"} {p.jenis} — {p.kategori}
              </summary>
              <p className="mt-2 text-slate-600">{p.alasan}</p>
            </details>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">
        Early Warning mendeteksi sinyal sederhana: proyeksi melebihi pagu untuk jenis belanja selain Belanja
        Pegawai, dan lonjakan/perlambatan realisasi bulan terakhir yang menyimpang jauh dari rata-rata bulan
        sebelumnya. Skor risiko adalah akumulasi poin dari sinyal yang terdeteksi (maks. 100).
      </p>
    </div>
  );
}
