import "server-only";
import { KategoriRow, TkdRow } from "./data";
import { fmtDept, fmtSatker } from "./format";

export type CariGenerikArgs = {
  kata_kunci?: string[];
  provinsi?: string;
  tahun_cari?: number;
};

/** Port dari buat_cari_generik() di common.py -- versi generik yang dipakai halaman
 * Prioritas Presiden, Program Strategis, dan Dana Transfer ke Daerah (dataset kecil,
 * jadi bisa dicari langsung di memori tanpa loader lazy seperti data utama). */
export function cariGenerikKategori(
  semuaRows: KategoriRow[],
  args: CariGenerikArgs,
  scopeKdsatker: number | null,
  tahunDefault: number
): Record<string, unknown> {
  let rows = semuaRows;
  if (scopeKdsatker !== null) rows = rows.filter((r) => r.KDSATKER === scopeKdsatker);

  const tahunCari = args.tahun_cari || tahunDefault;
  rows = rows.filter((r) => r.TAHUN === tahunCari);

  if (args.provinsi) {
    const p = args.provinsi.toLowerCase();
    rows = rows.filter((r) => (r.PROVINSI || "").toLowerCase().includes(p));
  }

  if (args.kata_kunci && args.kata_kunci.length > 0) {
    const kws = args.kata_kunci.map((k) => String(k).toLowerCase());
    rows = rows.filter((r) => {
      const teks = [r.NMDEPT, r.NMSATKER, r.KABKOTA, r.KEGIATAN, r.OUTPUT, r.SUBOUTPUT, r.AKUN, r.KATEGORI]
        .filter(Boolean)
        .join(" | ")
        .toLowerCase();
      return kws.some((kw) => teks.includes(kw));
    });
  }

  if (rows.length === 0) {
    return { ditemukan: false, pesan: "Tidak ada baris data yang cocok dengan kata kunci/filter ini." };
  }

  const byEntitas = new Map<string, { KDDEPT: number; NMDEPT: string; KDSATKER: number; NMSATKER: string; PAGU: number; REALISASI: number }>();
  for (const r of rows) {
    const key = `${r.KDDEPT}|${r.KDSATKER}`;
    let g = byEntitas.get(key);
    if (!g) {
      g = { KDDEPT: r.KDDEPT, NMDEPT: r.NMDEPT, KDSATKER: r.KDSATKER, NMSATKER: r.NMSATKER, PAGU: 0, REALISASI: 0 };
      byEntitas.set(key, g);
    }
    g.PAGU += r.PAGU;
    g.REALISASI += r.REALISASI;
  }

  const rincian = Array.from(byEntitas.values())
    .sort((a, b) => b.PAGU - a.PAGU)
    .slice(0, 30)
    .map((g) => ({
      KDDEPT: fmtDept(g.KDDEPT), NMDEPT: g.NMDEPT,
      KDSATKER: fmtSatker(g.KDSATKER), NMSATKER: g.NMSATKER,
      PAGU: g.PAGU, REALISASI: g.REALISASI,
    }));

  return {
    ditemukan: true,
    tahun: tahunCari,
    jumlah_baris_cocok: rows.length,
    total_pagu: rows.reduce((a, r) => a + r.PAGU, 0),
    total_realisasi: rows.reduce((a, r) => a + r.REALISASI, 0),
    rincian_per_satker_top30: rincian,
  };
}

/** Versi untuk halaman Dana Transfer ke Daerah (dataset per KABKOTA, tanpa info satker). */
export function cariGenerikTkd(semuaRows: TkdRow[], args: CariGenerikArgs, tahunDefault: number): Record<string, unknown> {
  let rows = semuaRows;
  const tahunCari = args.tahun_cari || tahunDefault;
  rows = rows.filter((r) => r.TAHUN === tahunCari);

  if (args.kata_kunci && args.kata_kunci.length > 0) {
    const kws = args.kata_kunci.map((k) => String(k).toLowerCase());
    rows = rows.filter((r) => {
      const teks = [r.KABKOTA, r.LABEL_JENIS_BELANJA].filter(Boolean).join(" | ").toLowerCase();
      return kws.some((kw) => teks.includes(kw));
    });
  }

  if (rows.length === 0) {
    return { ditemukan: false, pesan: "Tidak ada baris data TKD yang cocok dengan kata kunci/filter ini." };
  }

  const byKabkota = new Map<string, { KABKOTA: string; PAGU: number; REALISASI: number }>();
  for (const r of rows) {
    let g = byKabkota.get(r.KABKOTA);
    if (!g) {
      g = { KABKOTA: r.KABKOTA, PAGU: 0, REALISASI: 0 };
      byKabkota.set(r.KABKOTA, g);
    }
    g.PAGU += r.PAGU;
    g.REALISASI += r.REALISASI;
  }

  return {
    ditemukan: true,
    tahun: tahunCari,
    jumlah_baris_cocok: rows.length,
    total_pagu: rows.reduce((a, r) => a + r.PAGU, 0),
    total_realisasi: rows.reduce((a, r) => a + r.REALISASI, 0),
    rincian_per_kabkota: Array.from(byKabkota.values()).sort((a, b) => b.PAGU - a.PAGU).slice(0, 30),
  };
}
