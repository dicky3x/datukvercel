import { AggRow } from "./data";
import { BULAN_KOLOM, LABEL_BELANJA_PEGAWAI } from "./format";

/**
 * Versi sederhana dari mesin proyeksi hybrid di forecasting.py (repo asli).
 * Prinsip yang dipertahankan (lihat komentar view_dashboard_satker.py):
 *
 *   proyeksi_bulan_m = pagu_tahun_ini
 *     x [ Σ bobot_i x (realisasi_bulan_m_tahun(y-i) / pagu_tahun(y-i)) ] / Σ bobot_i
 *
 * yaitu pola bulanan (bulan m sebagai persentase dari pagu tahun itu) dirata-ratakan
 * tertimbang dari histori (tahun lebih baru diberi bobot lebih besar), lalu dikalikan
 * pagu tahun berjalan.
 *
 * Yang DISEDERHANAKAN dari versi asli (forecasting.py, ~1500 baris):
 * - Tidak ada fallback berjenjang ke "satker sejenis" saat histori kosong (di sini
 *   fallback-nya adalah rata-rata bulan berjalan, sama seperti fallback lama).
 * - Tidak ada penyesuaian kebijakan manual (mis. kenaikan tunjangan kinerja).
 * - Skor keyakinan dihitung dari koefisien variasi pola historis + penalti histori
 *   tipis, disederhanakan dari versi asli.
 */

export type KategoriProyeksi = {
  label: string;
  pagu: number;
  bulanan: number[]; // 12 nilai, aktual utk bulan penuh + proyeksi utk sisanya
  aktual: number[]; // realisasi aktual murni per bulan (tanpa proyeksi)
  confidence: number | null;
};

const BOBOT_TAHUN: Record<number, number> = { 1: 0.5, 2: 0.25, 3: 0.125, 4: 0.0625, 5: 0.0625 };

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

export function hitungBulanPenuhTerakhir<T extends Record<string, unknown>>(rowsEntitas: T[], tahun: number): number {
  const monthly = BULAN_KOLOM.map((b) => rowsEntitas.reduce((a, r) => a + (Number(r[b]) || 0), 0));
  const now = new Date();
  const bulanKalenderBerjalan = tahun < now.getFullYear() ? 13 : tahun > now.getFullYear() ? 1 : now.getMonth() + 1;
  // bulan terakhir yang punya data > 0
  let terakhirAdaData = 0;
  for (let i = 0; i < 12; i++) {
    if (monthly[i] > 0) terakhirAdaData = i + 1;
  }
  return Math.min(terakhirAdaData, bulanKalenderBerjalan - 1);
}

/**
 * Port dari hitung_proyeksi_agregat() di common.py -- proyeksi SATU rate gabungan
 * (bukan per kategori) untuk entitas terpilih, dipakai oleh halaman Prioritas Presiden,
 * Program Strategis, dan Dana Transfer ke Daerah (yang datanya cuma tersedia 1 tahun,
 * jadi proyeksinya mengandalkan histori dari sumber data utama/pagu_realisasi bila ada,
 * atau fallback ke rerata bulan berjalan kalau histori kosong).
 */
export function hitungProyeksiAgregat<T extends { TAHUN: number; PAGU: number; [k: string]: unknown }>(
  semuaRows: T[],
  tahun: number,
  paguY: number,
  matchEntitas: (r: T) => boolean
): { bulanan: number[] | null; tahunDipakai: number[] } {
  let totalRate = new Array(12).fill(0);
  let totalBobot = 0;
  const tahunDipakai: number[] = [];

  for (let d = 1; d <= 5; d++) {
    const thnLalu = tahun - d;
    const rowsLalu = semuaRows.filter((r) => r.TAHUN === thnLalu && matchEntitas(r));
    const paguLalu = rowsLalu.reduce((a, r) => a + r.PAGU, 0);
    if (paguLalu <= 0) continue;
    const monthlyLalu = BULAN_KOLOM.map((b) => rowsLalu.reduce((a, r) => a + (Number(r[b]) || 0), 0));
    const bobot = BOBOT_TAHUN[d] ?? 0;
    totalRate = totalRate.map((v, i) => v + bobot * (monthlyLalu[i] / paguLalu));
    totalBobot += bobot;
    tahunDipakai.push(thnLalu);
  }

  if (totalBobot === 0) return { bulanan: null, tahunDipakai };
  return { bulanan: totalRate.map((v) => (v / totalBobot) * paguY), tahunDipakai };
}

/**
 * Hitung proyeksi per kategori (LABEL_JENIS_BELANJA) untuk satu entitas (hasil filter
 * KDDEPT/KDSATKER sesuai sidebar), memakai histori entitas yang SAMA di tahun-tahun
 * sebelumnya (maks 5 tahun ke belakang).
 */
export function hitungProyeksiPerKategori(
  semuaRows: AggRow[],
  rowsEntitasTahunIni: AggRow[],
  tahun: number,
  bulanPenuhTerakhir: number,
  matchEntitas: (r: AggRow) => boolean
): KategoriProyeksi[] {
  const labelSet = Array.from(new Set(rowsEntitasTahunIni.map((r) => r.LABEL_JENIS_BELANJA)));
  // urutkan sesuai kode jenis belanja (51, 52, 53, ...)
  const kodeByLabel = new Map<string, string>();
  for (const r of rowsEntitasTahunIni) kodeByLabel.set(r.LABEL_JENIS_BELANJA, r.JENIS_BELANJA);
  labelSet.sort((a, b) => (kodeByLabel.get(a) || "").localeCompare(kodeByLabel.get(b) || ""));

  return labelSet.map((label) => {
    const rowsKategoriIni = rowsEntitasTahunIni.filter((r) => r.LABEL_JENIS_BELANJA === label);
    const pagu = rowsKategoriIni.reduce((a, r) => a + r.PAGU, 0);
    const aktualBulanan = BULAN_KOLOM.map((b) =>
      rowsKategoriIni.reduce((a, r) => a + (Number(r[b]) || 0), 0)
    );

    // Kumpulkan rasio historis (bulan m / pagu tahun itu) dari maks 5 tahun sebelumnya
    // (sama seperti hitung_proyeksi_agregat asli), untuk entitas & kategori yang sama.
    const rasioPerTahun: { tahun: number; d: number; rasio: number[] }[] = [];
    for (let d = 1; d <= 5; d++) {
      const thnLalu = tahun - d;
      const rowsLalu = semuaRows.filter(
        (r) => r.TAHUN === thnLalu && r.LABEL_JENIS_BELANJA === label && matchEntitas(r)
      );
      if (rowsLalu.length === 0) continue;
      const paguLalu = rowsLalu.reduce((a, r) => a + r.PAGU, 0);
      if (paguLalu <= 0) continue;
      const bulananLalu = BULAN_KOLOM.map((b) => rowsLalu.reduce((a, r) => a + (Number(r[b]) || 0), 0));
      rasioPerTahun.push({ tahun: thnLalu, d, rasio: bulananLalu.map((v) => v / paguLalu) });
    }

    let bulananHasil: number[];
    let confidence: number | null;

    if (rasioPerTahun.length === 0 || pagu <= 0) {
      // Fallback: rata-rata bulan berjalan x 12, disebar rata ke bulan tersisa.
      const totalSdBulanIni = aktualBulanan.slice(0, bulanPenuhTerakhir).reduce((a, b) => a + b, 0);
      const rerata = bulanPenuhTerakhir > 0 ? totalSdBulanIni / bulanPenuhTerakhir : 0;
      bulananHasil = BULAN_KOLOM.map((_, i) => (i < bulanPenuhTerakhir ? aktualBulanan[i] : rerata));
      confidence = null;
    } else {
      // Rata-rata tertimbang pola bulanan (tahun lebih baru bobot lebih besar).
      const bulananProfil = BULAN_KOLOM.map((_, i) => {
        let totalBobot = 0;
        let totalNilai = 0;
        rasioPerTahun.forEach((rt) => {
          const bobot = BOBOT_TAHUN[rt.d] ?? 0;
          totalNilai += bobot * rt.rasio[i];
          totalBobot += bobot;
        });
        return totalBobot > 0 ? (totalNilai / totalBobot) * pagu : 0;
      });

      // Belanja Pegawai boleh melebihi pagu (kebijakan gaji/tunjangan bisa naik).
      // Jenis belanja lain dibatasi maksimum pagu.
      const capMaxPagu = label !== LABEL_BELANJA_PEGAWAI;

      bulananHasil = BULAN_KOLOM.map((_, i) => (i < bulanPenuhTerakhir ? aktualBulanan[i] : bulananProfil[i]));
      if (capMaxPagu) {
        const totalSementara = bulananHasil.reduce((a, b) => a + b, 0);
        if (totalSementara > pagu && totalSementara > 0) {
          const sisaPagu = Math.max(pagu - aktualBulanan.slice(0, bulanPenuhTerakhir).reduce((a, b) => a + b, 0), 0);
          const totalProfilSisa = bulananProfil.slice(bulanPenuhTerakhir).reduce((a, b) => a + b, 0);
          bulananHasil = bulananHasil.map((v, i) => {
            if (i < bulanPenuhTerakhir) return v;
            return totalProfilSisa > 0 ? (bulananProfil[i] / totalProfilSisa) * sisaPagu : 0;
          });
        }
      }

      // Skor keyakinan: makin stabil (koefisien variasi kecil) pola historisnya makin
      // tinggi skornya; penalti kalau histori < 3 tahun.
      const rasioTahunanTotal = rasioPerTahun.map((rt) => rt.rasio.reduce((a, b) => a + b, 0));
      const cv = rasioTahunanTotal.length > 1
        ? stdev(rasioTahunanTotal) / (rasioTahunanTotal.reduce((a, b) => a + b, 0) / rasioTahunanTotal.length || 1)
        : 0.3; // histori 1 tahun -> anggap keyakinan sedang
      let skor = Math.max(0, Math.min(100, 100 * (1 - cv)));
      if (rasioPerTahun.length < 3) skor -= (3 - rasioPerTahun.length) * 15;
      confidence = Math.max(0, Math.min(100, skor));
    }

    return { label, pagu, bulanan: bulananHasil, aktual: aktualBulanan, confidence };
  });
}
