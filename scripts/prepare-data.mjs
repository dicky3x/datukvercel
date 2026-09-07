// Skrip build-time: baca data/pagu_realisasi.csv.gz, agregasi ke level
// TAHUN x KDDEPT x KDSATKER x JENIS BELANJA (cukup untuk dashboard & KPI),
// simpan sebagai JSON kecil di data/aggregated.json supaya tidak perlu
// parse ulang 120rb baris CSV di setiap request serverless.
//
// Jalankan otomatis lewat `npm run build` (lihat package.json).

import { createReadStream, writeFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import path from "node:path";

const CSV_PATH = path.join(process.cwd(), "data", "pagu_realisasi.csv.gz");
const OUT_PATH = path.join(process.cwd(), "data", "aggregated.json");

const BULAN_KOLOM = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGS", "SEP", "OKT", "NOV", "DES"];

function numOr0(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const groups = new Map();

  await new Promise((resolve, reject) => {
    const stream = createReadStream(CSV_PATH)
      .pipe(createGunzip())
      .pipe(parse({ columns: true, skip_empty_lines: true }));

    stream.on("data", (row) => {
      const key = [
        row.TAHUN,
        row.KDDEPT,
        row.KDSATKER,
        row["JENIS BELANJA"],
      ].join("|");

      let g = groups.get(key);
      if (!g) {
        g = {
          TAHUN: parseInt(row.TAHUN, 10),
          KDDEPT: parseInt(row.KDDEPT, 10),
          NMDEPT: row.NMDEPT,
          KDSATKER: parseInt(row.KDSATKER, 10),
          NMSATKER: row.NMSATKER,
          JENIS_BELANJA: row["JENIS BELANJA"],
          LABEL_JENIS_BELANJA: row.LABEL_JENIS_BELANJA,
          PAGU: 0,
          REALISASI: 0,
          SISA_PAGU: 0,
          BLOKIR: 0,
        };
        for (const b of BULAN_KOLOM) g[b] = 0;
        groups.set(key, g);
      }
      g.PAGU += numOr0(row.PAGU);
      g.REALISASI += numOr0(row.REALISASI);
      g.SISA_PAGU += numOr0(row["SISA PAGU"]);
      g.BLOKIR += numOr0(row.BLOKIR);
      for (const b of BULAN_KOLOM) g[b] += numOr0(row[b]);
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  const result = Array.from(groups.values());
  writeFileSync(OUT_PATH, JSON.stringify(result));
  console.log(`Agregasi selesai: ${result.length} baris -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
