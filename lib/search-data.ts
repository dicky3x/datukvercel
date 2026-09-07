import "server-only";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import path from "node:path";
import { parse } from "csv-parse";
import { fmtDept, fmtSatker } from "./format";

export type DetailRow = {
  KDDEPT: number;
  NMDEPT: string;
  KDSATKER: number;
  NMSATKER: string;
  TAHUN: number;
  PAGU: number;
  REALISASI: number;
  PROVINSI: string;
  teks: string; // gabungan kolom tematik, lowercase, utk pencarian kata kunci
};

let cachePromise: Promise<DetailRow[]> | null = null;

/** Baca & parse data/pagu_realisasi.csv.gz (~120rb baris) sekali saja, cache di memori
 * selama lambda/instance warm. Hanya dipakai oleh tool pencarian tematik AI chat --
 * dashboard utama pakai data agregat yang jauh lebih kecil (lib/data.ts). */
function loadDetail(): Promise<DetailRow[]> {
  if (cachePromise) return cachePromise;
  const csvPath = path.join(process.cwd(), "data", "pagu_realisasi.csv.gz");
  cachePromise = new Promise((resolve, reject) => {
    const rows: DetailRow[] = [];
    createReadStream(csvPath)
      .pipe(createGunzip())
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on("data", (r) => {
        const teks = [r.FUNGSI, r.SUBFUNGSI, r.PROGRAM, r.KEGIATAN, r.OUTPUT, r.AKUN, r.LABEL_JENIS_BELANJA]
          .filter(Boolean)
          .join(" | ")
          .toLowerCase();
        rows.push({
          KDDEPT: parseInt(r.KDDEPT, 10),
          NMDEPT: r.NMDEPT,
          KDSATKER: parseInt(r.KDSATKER, 10),
          NMSATKER: r.NMSATKER,
          TAHUN: parseInt(r.TAHUN, 10),
          PAGU: parseFloat(r.PAGU) || 0,
          REALISASI: parseFloat(r.REALISASI) || 0,
          PROVINSI: r.PROVINSI || "",
          teks,
        });
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
  return cachePromise;
}

export type CariAnggaranArgs = {
  kata_kunci?: string[];
  provinsi?: string;
  tahun_cari?: number;
};

/** Port dari cari_anggaran() di view_dashboard_satker.py -- pencarian tematik lintas
 * satker/kementerian/provinsi yang dipakai tool-calling AI chat. */
export async function cariAnggaran(
  args: CariAnggaranArgs,
  scopeKdsatker: number | null,
  tahunDefault: number
): Promise<Record<string, unknown>> {
  let rows = await loadDetail();

  if (scopeKdsatker !== null) rows = rows.filter((r) => r.KDSATKER === scopeKdsatker);

  const tahunCari = args.tahun_cari || tahunDefault;
  rows = rows.filter((r) => r.TAHUN === tahunCari);

  if (args.provinsi) {
    const p = args.provinsi.toLowerCase();
    rows = rows.filter((r) => r.PROVINSI.toLowerCase().includes(p));
  }

  if (args.kata_kunci && args.kata_kunci.length > 0) {
    const kws = args.kata_kunci.map((k) => String(k).toLowerCase());
    rows = rows.filter((r) => kws.some((kw) => r.teks.includes(kw)));
  }

  if (rows.length === 0) {
    return {
      ditemukan: false,
      pesan:
        "Tidak ada baris data yang cocok dengan kata kunci/filter ini. Kemungkinan temanya tidak " +
        "tercatat secara eksplisit di nama program/kegiatan/output pada level detail yang tersedia.",
    };
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
      KDDEPT: fmtDept(g.KDDEPT),
      NMDEPT: g.NMDEPT,
      KDSATKER: fmtSatker(g.KDSATKER),
      NMSATKER: g.NMSATKER,
      PAGU: g.PAGU,
      REALISASI: g.REALISASI,
    }));

  return {
    ditemukan: true,
    tahun: tahunCari,
    jumlah_baris_cocok: rows.length,
    jumlah_satker_ditemukan: byEntitas.size,
    total_pagu: rows.reduce((a, r) => a + r.PAGU, 0),
    total_realisasi: rows.reduce((a, r) => a + r.REALISASI, 0),
    rincian_per_satker_top30: rincian,
    catatan:
      "rincian_per_satker_top30 diurutkan dari pagu terbesar, dibatasi 30 baris teratas. total_pagu & " +
      "total_realisasi sudah menjumlahkan SEMUA satker yang cocok, tidak hanya yang ditampilkan." +
      (scopeKdsatker !== null ? " Pencarian ini dibatasi hanya pada data satker Anda sendiri." : ""),
  };
}
