import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { getSession } from "@/lib/auth";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 20000;

export async function POST(req: NextRequest) {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (auth.role !== "super") {
    return NextResponse.json({ error: "Fitur upload dataset hanya untuk super user." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Tidak ada file yang diupload." }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File terlalu besar (maks ${(MAX_BYTES / 1e6).toFixed(0)}MB). File Anda: ${(file.size / 1e6).toFixed(1)}MB.` },
      { status: 400 }
    );
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".tsv") && !name.endsWith(".txt")) {
    return NextResponse.json(
      {
        error:
          "Format file tidak didukung. Saat ini hanya CSV/TSV yang didukung (Excel .xlsx sengaja belum " +
          "didukung karena parser Excel yang tersedia untuk Node.js punya kerentanan keamanan yang belum " +
          "ada perbaikannya -- lihat README.md). Silakan export/save-as file Anda ke CSV terlebih dahulu.",
      },
      { status: 400 }
    );
  }

  const text = await file.text();
  const delimiter = name.endsWith(".tsv") ? "\t" : ",";

  let records: Record<string, string>[];
  try {
    records = parse(text, { columns: true, skip_empty_lines: true, delimiter, trim: true });
  } catch (e) {
    return NextResponse.json({ error: `Gagal membaca file: ${(e as Error).message}` }, { status: 400 });
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "File kosong atau tidak punya baris data." }, { status: 400 });
  }

  const truncated = records.length > MAX_ROWS;
  if (truncated) records = records.slice(0, MAX_ROWS);

  const columns = Object.keys(records[0]);

  // Deteksi kolom numerik sederhana (>=80% baris terisi angka valid) supaya UI/AI tahu
  // kolom mana yang bisa diagregasi (sum/mean/dll).
  const numericColumns = columns.filter((c) => {
    const sample = records.slice(0, Math.min(records.length, 200));
    const numCount = sample.filter((r) => r[c] !== "" && !isNaN(Number(r[c]))).length;
    return numCount / sample.length >= 0.8;
  });

  // Konversi kolom numerik ke number supaya agregasi di /api/chat-dataset akurat.
  const rows = records.map((r) => {
    const o: Record<string, string | number> = {};
    for (const c of columns) {
      o[c] = numericColumns.includes(c) && r[c] !== "" ? Number(r[c]) : r[c];
    }
    return o;
  });

  return NextResponse.json({
    fileName: file.name,
    columns,
    numericColumns,
    rowCount: rows.length,
    truncated,
    rows,
  });
}
