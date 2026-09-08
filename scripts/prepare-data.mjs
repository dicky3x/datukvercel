// Skrip build-time: baca semua file data/*.csv.gz, hasilkan JSON kecil yang siap
// dipakai dashboard tanpa perlu parse ulang CSV mentah di tiap request serverless.
// Jalankan otomatis lewat `npm run build` (lihat package.json).

import { createReadStream, writeFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const BULAN_KOLOM = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGS", "SEP", "OKT", "NOV", "DES"];
const KODE_JENIS_TKD = new Set(["61", "62", "63", "64", "65", "66"]);

function numOr0(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function parseGzipCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(createGunzip())
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on("data", (r) => rows.push(r))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

// --- 1. Data utama (pagu_realisasi.csv.gg) -> agregat TAHUN x KDDEPT x KDSATKER x
//        JENIS BELANJA (dashboard utama), + agregat TAHUN x KABKOTA x JENIS BELANJA
//        khusus kode 61-66 (dashboard Dana Transfer ke Daerah).
async function prepareUtama() {
  const groupsUtama = new Map();
  const groupsTkd = new Map();

  await new Promise((resolve, reject) => {
    const stream = createReadStream(path.join(DATA_DIR, "pagu_realisasi.csv.gz"))
      .pipe(createGunzip())
      .pipe(parse({ columns: true, skip_empty_lines: true }));

    stream.on("data", (row) => {
      const jenis = row["JENIS BELANJA"];
      const keyUtama = [row.TAHUN, row.KDDEPT, row.KDSATKER, jenis].join("|");
      let g = groupsUtama.get(keyUtama);
      if (!g) {
        g = {
          TAHUN: parseInt(row.TAHUN, 10),
          KDDEPT: parseInt(row.KDDEPT, 10),
          NMDEPT: row.NMDEPT,
          KDSATKER: parseInt(row.KDSATKER, 10),
          NMSATKER: row.NMSATKER,
          JENIS_BELANJA: jenis,
          LABEL_JENIS_BELANJA: row.LABEL_JENIS_BELANJA,
          PAGU: 0, REALISASI: 0, SISA_PAGU: 0, BLOKIR: 0,
        };
        for (const b of BULAN_KOLOM) g[b] = 0;
        groupsUtama.set(keyUtama, g);
      }
      g.PAGU += numOr0(row.PAGU);
      g.REALISASI += numOr0(row.REALISASI);
      g.SISA_PAGU += numOr0(row["SISA PAGU"]);
      g.BLOKIR += numOr0(row.BLOKIR);
      for (const b of BULAN_KOLOM) g[b] += numOr0(row[b]);

      if (KODE_JENIS_TKD.has(String(jenis).trim())) {
        const keyTkd = [row.TAHUN, row.KABKOTA, jenis].join("|");
        let t = groupsTkd.get(keyTkd);
        if (!t) {
          t = {
            TAHUN: parseInt(row.TAHUN, 10),
            KABKOTA: row.KABKOTA,
            JENIS_BELANJA: jenis,
            LABEL_JENIS_BELANJA: row.LABEL_JENIS_BELANJA,
            PAGU: 0, REALISASI: 0, SISA_PAGU: 0, BLOKIR: 0,
          };
          for (const b of BULAN_KOLOM) t[b] = 0;
          groupsTkd.set(keyTkd, t);
        }
        t.PAGU += numOr0(row.PAGU);
        t.REALISASI += numOr0(row.REALISASI);
        t.SISA_PAGU += numOr0(row["SISA PAGU"]);
        t.BLOKIR += numOr0(row.BLOKIR);
        for (const b of BULAN_KOLOM) t[b] += numOr0(row[b]);
      }
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  const resultUtama = Array.from(groupsUtama.values());
  writeFileSync(path.join(DATA_DIR, "aggregated.json"), JSON.stringify(resultUtama));
  console.log(`Agregasi utama selesai: ${resultUtama.length} baris -> data/aggregated.json`);

  const resultTkd = Array.from(groupsTkd.values());
  writeFileSync(path.join(DATA_DIR, "tkd.json"), JSON.stringify(resultTkd));
  console.log(`Agregasi TKD selesai: ${resultTkd.length} baris -> data/tkd.json`);
}

// --- 2. Data kategori (Prioritas Presiden & Program Strategis) -- datasetnya kecil
//        (ratusan baris), jadi cukup disimpan apa adanya sebagai JSON (tanpa agregasi).
async function prepareKategori(fileName, outName) {
  const filePath = path.join(DATA_DIR, fileName);
  const rows = await parseGzipCsv(filePath);
  const out = rows.map((r) => {
    const o = {
      TAHUN: parseInt(r.TAHUN, 10),
      KDDEPT: parseInt(r.KDDEPT, 10),
      NMDEPT: r.NMDEPT,
      KDSATKER: parseInt(r.KDSATKER, 10),
      NMSATKER: r.NMSATKER,
      PROVINSI: r.PROVINSI,
      KABKOTA: r.KABKOTA,
      KEGIATAN: r.KEGIATAN,
      OUTPUT: r.OUTPUT,
      SUBOUTPUT: r.SUBOUTPUT,
      AKUN: r.AKUN,
      KATEGORI: r.KATEGORI,
      PAGU: numOr0(r.PAGU),
      BLOKIR: numOr0(r.BLOKIR),
      REALISASI: numOr0(r.REALISASI),
      SISA_PAGU: numOr0(r["SISA PAGU"]),
    };
    for (const b of BULAN_KOLOM) o[b] = numOr0(r[b]);
    return o;
  });
  writeFileSync(path.join(DATA_DIR, outName), JSON.stringify(out));
  console.log(`${fileName}: ${out.length} baris -> data/${outName}`);
}

async function main() {
  await prepareUtama();
  await prepareKategori("prioritas_presiden.csv.gz", "prioritas.json");
  await prepareKategori("program_strategis.csv.gz", "strategis.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
