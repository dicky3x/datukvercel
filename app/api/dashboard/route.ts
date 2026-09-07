import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAggregatedData, AggRow } from "@/lib/data";
import { BULAN_KOLOM, fmtDept, fmtSatker } from "@/lib/format";
import { hitungBulanPenuhTerakhir, hitungProyeksiPerKategori } from "@/lib/projection";

export async function GET(req: NextRequest) {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const all = getAggregatedData();
  const isSuper = auth.role === "super";
  const sp = req.nextUrl.searchParams;

  const years = Array.from(new Set(all.map((r) => r.TAHUN))).sort((a, b) => b - a);

  let scopeKdsatker: number | null = null;
  let tahun: number;
  let kddept: number | null = null;
  let kdsatker: number | null = null;

  if (isSuper) {
    tahun = parseInt(sp.get("tahun") || "", 10) || years[0];
    const kddeptParam = sp.get("kddept");
    kddept = kddeptParam ? parseInt(kddeptParam, 10) : null;
    const kdsatkerParam = sp.get("kdsatker");
    kdsatker = kdsatkerParam ? parseInt(kdsatkerParam, 10) : null;
  } else {
    scopeKdsatker = auth.kdsatker;
    kdsatker = auth.kdsatker;
    const rowsSatkerSemuaTahun = all.filter((r) => r.KDSATKER === scopeKdsatker);
    const tahunListSatker = Array.from(new Set(rowsSatkerSemuaTahun.map((r) => r.TAHUN))).sort((a, b) => b - a);
    tahun = parseInt(sp.get("tahun") || "", 10) || tahunListSatker[0] || years[0];
    const rowSample = rowsSatkerSemuaTahun.find((r) => r.TAHUN === tahun);
    kddept = rowSample ? rowSample.KDDEPT : null;
  }

  const rowsTahun = all.filter((r) => r.TAHUN === tahun);

  // Opsi dropdown untuk super user
  const deptOptions = Array.from(
    new Map(rowsTahun.map((r) => [r.KDDEPT, { kddept: r.KDDEPT, nmdept: r.NMDEPT }])).values()
  ).sort((a, b) => a.kddept - b.kddept);

  const rowsDept = kddept !== null ? rowsTahun.filter((r) => r.KDDEPT === kddept) : rowsTahun;

  const satkerOptions = Array.from(
    new Map(rowsDept.map((r) => [r.KDSATKER, { kdsatker: r.KDSATKER, nmsatker: r.NMSATKER }])).values()
  ).sort((a, b) => a.kdsatker - b.kdsatker);

  const rowsEntitas = kdsatker !== null ? rowsDept.filter((r) => r.KDSATKER === kdsatker) : rowsDept;

  if (rowsEntitas.length === 0) {
    return NextResponse.json({
      isSuper,
      years,
      deptOptions,
      satkerOptions,
      selection: { tahun, kddept, kdsatker },
      empty: true,
    });
  }

  const nmdept = kddept !== null ? rowsEntitas[0]?.NMDEPT ?? "-" : "Semua Kementerian/Lembaga";
  const nmsatker = kdsatker !== null ? rowsEntitas[0]?.NMSATKER ?? "-" : "Semua Satker";

  const paguTotal = rowsEntitas.reduce((a, r) => a + r.PAGU, 0);
  const realisasiTotal = rowsEntitas.reduce((a, r) => a + r.REALISASI, 0);
  const sisaPagu = rowsEntitas.reduce((a, r) => a + r.SISA_PAGU, 0);
  const blokirTotal = rowsEntitas.reduce((a, r) => a + r.BLOKIR, 0);
  const persenSerapan = paguTotal ? (realisasiTotal / paguTotal) * 100 : 0;

  const monthly = BULAN_KOLOM.map((b) => rowsEntitas.reduce((a, r) => a + (Number(r[b]) || 0), 0));

  const jenisBelanja = Array.from(new Set(rowsEntitas.map((r) => r.LABEL_JENIS_BELANJA)))
    .map((label) => ({
      label,
      realisasi: rowsEntitas.filter((r) => r.LABEL_JENIS_BELANJA === label).reduce((a, r) => a + r.REALISASI, 0),
    }))
    .sort((a, b) => b.realisasi - a.realisasi);

  const bulanPenuhTerakhir = hitungBulanPenuhTerakhir(rowsEntitas, tahun);

  const matchEntitas = (r: AggRow) => {
    if (kdsatker !== null) return r.KDSATKER === kdsatker;
    if (kddept !== null) return r.KDDEPT === kddept;
    return true;
  };

  const kategoriProyeksi = hitungProyeksiPerKategori(all, rowsEntitas, tahun, bulanPenuhTerakhir, matchEntitas);
  const totalBulananProyeksi = BULAN_KOLOM.map((_, i) =>
    kategoriProyeksi.reduce((a, k) => a + k.bulanan[i], 0)
  );
  const proyeksiAkhirTahun = totalBulananProyeksi.reduce((a, b) => a + b, 0);
  const persenProyeksi = paguTotal ? (proyeksiAkhirTahun / paguTotal) * 100 : 0;

  const bobotConf = kategoriProyeksi.reduce((a, k) => a + Math.max(k.pagu, 1), 0);
  const confidenceKeseluruhan =
    bobotConf > 0
      ? kategoriProyeksi.reduce((a, k) => a + (k.confidence ?? 0) * Math.max(k.pagu, 1), 0) / bobotConf
      : null;

  // Early warning sederhana: proyeksi melebihi pagu untuk kategori non-pegawai,
  // dan lonjakan bulan terakhir jauh di luar rata-rata bulan sebelumnya.
  const peringatan: { tingkat: string; jenis: string; kategori: string; alasan: string }[] = [];
  for (const k of kategoriProyeksi) {
    const totalProyeksiKategori = k.bulanan.reduce((a, b) => a + b, 0);
    if (k.label !== "Belanja Pegawai" && k.pagu > 0 && totalProyeksiKategori > k.pagu * 1.02) {
      peringatan.push({
        tingkat: "Tinggi",
        jenis: "Proyeksi melebihi pagu",
        kategori: k.label,
        alasan: `Proyeksi realisasi akhir tahun (${Math.round(totalProyeksiKategori).toLocaleString(
          "id-ID"
        )}) diperkirakan melebihi pagu (${Math.round(k.pagu).toLocaleString("id-ID")}).`,
      });
    }
  }
  if (bulanPenuhTerakhir >= 2) {
    const bulanBerjalan = monthly[bulanPenuhTerakhir - 1];
    const rataSebelumnya =
      monthly.slice(0, bulanPenuhTerakhir - 1).reduce((a, b) => a + b, 0) / (bulanPenuhTerakhir - 1);
    if (rataSebelumnya > 0 && Math.abs(bulanBerjalan - rataSebelumnya) > rataSebelumnya * 1.0) {
      peringatan.push({
        tingkat: "Sedang",
        jenis: bulanBerjalan > rataSebelumnya ? "Lonjakan realisasi" : "Perlambatan realisasi",
        kategori: "Total",
        alasan: `Realisasi bulan ${BULAN_KOLOM[bulanPenuhTerakhir - 1]} (${Math.round(
          bulanBerjalan
        ).toLocaleString("id-ID")}) menyimpang jauh dari rata-rata bulan sebelumnya (${Math.round(
          rataSebelumnya
        ).toLocaleString("id-ID")}).`,
      });
    }
  }
  const skorRisiko = Math.min(
    100,
    peringatan.reduce((a, p) => a + (p.tingkat === "Tinggi" ? 30 : p.tingkat === "Sedang" ? 15 : 5), 0)
  );
  const kategoriRisiko = skorRisiko >= 60 ? "Tinggi" : skorRisiko >= 25 ? "Sedang" : "Rendah";

  return NextResponse.json({
    isSuper,
    years,
    deptOptions: deptOptions.map((d) => ({ ...d, label: `${fmtDept(d.kddept)} - ${d.nmdept}` })),
    satkerOptions: satkerOptions.map((s) => ({ ...s, label: `${fmtSatker(s.kdsatker)} - ${s.nmsatker}` })),
    selection: { tahun, kddept, kdsatker, nmdept, nmsatker },
    kpi: {
      pagu: paguTotal,
      realisasi: realisasiTotal,
      sisaPagu,
      blokir: blokirTotal,
      persenSerapan,
      proyeksiAkhirTahun,
      persenProyeksi,
      confidenceKeseluruhan,
    },
    monthly,
    jenisBelanja,
    bulanPenuhTerakhir,
    proyeksi: {
      totalBulanan: totalBulananProyeksi,
      kategori: kategoriProyeksi,
    },
    earlyWarning: { skorRisiko, kategoriRisiko, peringatan },
  });
}
