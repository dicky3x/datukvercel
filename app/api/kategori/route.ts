import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrioritasData, getStrategisData, KategoriRow } from "@/lib/data";
import { BULAN_KOLOM } from "@/lib/format";
import { hitungBulanPenuhTerakhir, hitungProyeksiAgregat } from "@/lib/projection";

const JUDUL: Record<string, { judul: string; icon: string; label: string }> = {
  prioritas: { judul: "Dashboard Prioritas Presiden", icon: "⭐", label: "Prioritas Presiden" },
  strategis: { judul: "Dashboard Program Strategis", icon: "🎯", label: "Program Strategis" },
};

export async function GET(req: NextRequest) {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const dataset = sp.get("dataset") === "strategis" ? "strategis" : "prioritas";
  const meta = JUDUL[dataset];

  const semua: KategoriRow[] = dataset === "strategis" ? getStrategisData() : getPrioritasData();

  const scopeKdsatker = auth.role === "super" ? null : auth.kdsatker;
  let df = semua;
  if (scopeKdsatker !== null) {
    df = df.filter((r) => r.KDSATKER === scopeKdsatker);
    if (df.length === 0) {
      return NextResponse.json({ ...meta, dataset, tersedia: true, tidakAdaUntukSatker: true });
    }
  }

  const years = Array.from(new Set(df.map((r) => r.TAHUN))).sort((a, b) => b - a);
  const tahun = parseInt(sp.get("tahun") || "", 10) || years[0];
  const dfTahun = df.filter((r) => r.TAHUN === tahun);

  const kategoriList = Array.from(new Set(dfTahun.map((r) => r.KATEGORI))).sort();
  const kategoriParam = sp.get("kategori");
  const kategori = kategoriParam && kategoriList.includes(kategoriParam) ? kategoriParam : null;
  const dfScope = kategori ? dfTahun.filter((r) => r.KATEGORI === kategori) : dfTahun;

  const paguTotal = dfScope.reduce((a, r) => a + r.PAGU, 0);
  const realisasiTotal = dfScope.reduce((a, r) => a + r.REALISASI, 0);
  const sisaPagu = dfScope.reduce((a, r) => a + r.SISA_PAGU, 0);
  const persenSerapan = paguTotal ? (realisasiTotal / paguTotal) * 100 : 0;

  const monthly = BULAN_KOLOM.map((b) => dfScope.reduce((a, r) => a + (Number(r[b]) || 0), 0));
  const bulanPenuhTerakhir = hitungBulanPenuhTerakhir(dfScope, tahun);

  // Proyeksi: dataset kategori cuma 1 tahun, jadi histori (kalau ada) berasal dari
  // tahun-tahun sebelumnya di dataset yang SAMA (jarang ada >1 tahun) -- kalau tak ada
  // histori sama sekali, fallback ke rerata bulan berjalan x 12 (sama seperti versi asli).
  const matchEntitas = (r: KategoriRow) => (kategori ? r.KATEGORI === kategori : true);
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

  // Komposisi kedua: per kategori (kalau "semua" dipilih) atau per kab/kota (kalau 1 kategori dipilih)
  let komposisiKedua: { name: string; value: number }[];
  if (!kategori) {
    komposisiKedua = Array.from(new Set(dfScope.map((r) => r.KATEGORI)))
      .map((k) => ({ name: k, value: dfScope.filter((r) => r.KATEGORI === k).reduce((a, r) => a + r.REALISASI, 0) }))
      .sort((a, b) => b.value - a.value);
  } else {
    komposisiKedua = Array.from(new Set(dfScope.map((r) => r.KABKOTA)))
      .map((k) => ({ name: k, value: dfScope.filter((r) => r.KABKOTA === k).reduce((a, r) => a + r.REALISASI, 0) }))
      .sort((a, b) => b.value - a.value);
  }

  // Tabel perbandingan antar kategori (hanya kalau "semua" dipilih)
  let perbandinganKategori: { kategori: string; pagu: number; realisasi: number; persen: number }[] | null = null;
  if (!kategori) {
    perbandinganKategori = kategoriList
      .map((k) => {
        const rows = dfTahun.filter((r) => r.KATEGORI === k);
        const p = rows.reduce((a, r) => a + r.PAGU, 0);
        const r_ = rows.reduce((a, r) => a + r.REALISASI, 0);
        return { kategori: k, pagu: p, realisasi: r_, persen: p ? (r_ / p) * 100 : 0 };
      })
      .sort((a, b) => b.pagu - a.pagu);
  }

  // Tabel rincian baris kegiatan/output/suboutput
  const rincian = dfScope
    .map((r) => ({
      kategori: r.KATEGORI,
      nmdept: r.NMDEPT,
      nmsatker: r.NMSATKER,
      kabkota: r.KABKOTA,
      kegiatan: r.KEGIATAN,
      output: r.OUTPUT,
      suboutput: r.SUBOUTPUT,
      akun: r.AKUN,
      pagu: r.PAGU,
      realisasi: r.REALISASI,
      persen: r.PAGU ? (r.REALISASI / r.PAGU) * 100 : 0,
    }))
    .sort((a, b) => b.pagu - a.pagu)
    .slice(0, 300);

  return NextResponse.json({
    ...meta,
    dataset,
    tersedia: true,
    years,
    kategoriList,
    selection: { tahun, kategori },
    kpi: { pagu: paguTotal, realisasi: realisasiTotal, sisaPagu, persenSerapan, proyeksiAkhirTahun, persenProyeksi },
    monthly,
    komposisiKedua,
    perbandinganKategori,
    rincian,
  });
}
