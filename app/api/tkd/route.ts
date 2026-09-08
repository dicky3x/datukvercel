import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTkdData, TkdRow } from "@/lib/data";
import { BULAN_KOLOM } from "@/lib/format";
import { hitungBulanPenuhTerakhir, hitungProyeksiAgregat } from "@/lib/projection";

export async function GET(req: NextRequest) {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (auth.role !== "super") {
    return NextResponse.json({ error: "Halaman ini hanya bisa diakses oleh super user." }, { status: 403 });
  }

  const semua = getTkdData();
  const sp = req.nextUrl.searchParams;

  const years = Array.from(new Set(semua.map((r) => r.TAHUN))).sort((a, b) => b - a);
  const tahun = parseInt(sp.get("tahun") || "", 10) || years[0];
  const dfTahun = semua.filter((r) => r.TAHUN === tahun);

  const kabkotaList = Array.from(new Set(dfTahun.map((r) => r.KABKOTA))).sort();
  const kabkotaParam = sp.get("kabkota");
  const kabkota = kabkotaParam && kabkotaList.includes(kabkotaParam) ? kabkotaParam : null;
  const dfWilayah = kabkota ? dfTahun.filter((r) => r.KABKOTA === kabkota) : dfTahun;

  const paguTotal = dfWilayah.reduce((a, r) => a + r.PAGU, 0);
  const realisasiTotal = dfWilayah.reduce((a, r) => a + r.REALISASI, 0);
  const sisaPagu = dfWilayah.reduce((a, r) => a + r.SISA_PAGU, 0);
  const persenSerapan = paguTotal ? (realisasiTotal / paguTotal) * 100 : 0;

  const monthly = BULAN_KOLOM.map((b) => dfWilayah.reduce((a, r) => a + (Number(r[b]) || 0), 0));
  const bulanPenuhTerakhir = hitungBulanPenuhTerakhir(dfWilayah, tahun);

  const matchEntitas = (r: TkdRow) => (kabkota ? r.KABKOTA === kabkota : true);
  const { bulanan: proyeksiBulanan } = hitungProyeksiAgregat(semua, tahun, paguTotal, matchEntitas);
  let proyeksiAkhirTahun: number;
  if (!proyeksiBulanan) {
    const totalSdBulanIni = monthly.slice(0, bulanPenuhTerakhir).reduce((a, b) => a + b, 0);
    const rerata = bulanPenuhTerakhir > 0 ? totalSdBulanIni / bulanPenuhTerakhir : 0;
    proyeksiAkhirTahun = rerata * 12;
  } else {
    proyeksiAkhirTahun = Math.max(realisasiTotal, proyeksiBulanan.reduce((a, b) => a + b, 0));
  }
  const persenProyeksi = paguTotal ? (proyeksiAkhirTahun / paguTotal) * 100 : 0;

  const jenisTkd = Array.from(new Set(dfWilayah.map((r) => r.LABEL_JENIS_BELANJA)))
    .map((label) => ({
      name: label,
      value: dfWilayah.filter((r) => r.LABEL_JENIS_BELANJA === label).reduce((a, r) => a + r.REALISASI, 0),
    }))
    .sort((a, b) => b.value - a.value);

  let perbandinganWilayah: { kabkota: string; pagu: number; realisasi: number; persen: number }[] | null = null;
  let rincianJenisWilayah: { jenis: string; pagu: number; realisasi: number; sisaPagu: number; persen: number }[] | null = null;

  if (!kabkota) {
    perbandinganWilayah = kabkotaList
      .map((k) => {
        const rows = dfTahun.filter((r) => r.KABKOTA === k);
        const p = rows.reduce((a, r) => a + r.PAGU, 0);
        const r_ = rows.reduce((a, r) => a + r.REALISASI, 0);
        return { kabkota: k, pagu: p, realisasi: r_, persen: p ? (r_ / p) * 100 : 0 };
      })
      .sort((a, b) => b.pagu - a.pagu);
  } else {
    rincianJenisWilayah = Array.from(new Set(dfWilayah.map((r) => r.LABEL_JENIS_BELANJA)))
      .map((jenis) => {
        const rows = dfWilayah.filter((r) => r.LABEL_JENIS_BELANJA === jenis);
        const p = rows.reduce((a, r) => a + r.PAGU, 0);
        const r_ = rows.reduce((a, r) => a + r.REALISASI, 0);
        const s = rows.reduce((a, r) => a + r.SISA_PAGU, 0);
        return { jenis, pagu: p, realisasi: r_, sisaPagu: s, persen: p ? (r_ / p) * 100 : 0 };
      })
      .sort((a, b) => b.pagu - a.pagu);
  }

  return NextResponse.json({
    years,
    kabkotaList,
    selection: { tahun, kabkota },
    kpi: { pagu: paguTotal, realisasi: realisasiTotal, sisaPagu, persenSerapan, proyeksiAkhirTahun, persenProyeksi },
    monthly,
    jenisTkd,
    perbandinganWilayah,
    rincianJenisWilayah,
  });
}
