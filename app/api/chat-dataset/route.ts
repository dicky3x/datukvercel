import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const FUNGSI_VALID = new Set(["sum", "mean", "count", "min", "max", "median", "std", "nunique"]);
const OPERATOR_VALID = new Set(["==", "!=", ">", "<", ">=", "<=", "contains"]);

type Row = Record<string, string | number>;
type Filter = { kolom: string; operator: string; nilai: string | number };

function terapkanFilter(rows: Row[], filters: Filter[]): Row[] {
  let out = rows;
  for (const f of filters) {
    if (!OPERATOR_VALID.has(f.operator)) continue;
    out = out.filter((r) => {
      const v = r[f.kolom];
      if (v === undefined) return false;
      if (f.operator === "contains") return String(v).toLowerCase().includes(String(f.nilai).toLowerCase());
      const a = typeof v === "number" ? v : Number(v);
      const b = typeof f.nilai === "number" ? f.nilai : Number(f.nilai);
      const bothNumeric = !isNaN(a) && !isNaN(b);
      switch (f.operator) {
        case "==":
          return bothNumeric ? a === b : String(v) === String(f.nilai);
        case "!=":
          return bothNumeric ? a !== b : String(v) !== String(f.nilai);
        case ">":
          return bothNumeric && a > b;
        case "<":
          return bothNumeric && a < b;
        case ">=":
          return bothNumeric && a >= b;
        case "<=":
          return bothNumeric && a <= b;
        default:
          return true;
      }
    });
  }
  return out;
}

function agregasi(values: number[], fungsi: string): number {
  const n = values.length;
  switch (fungsi) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "mean":
      return n ? values.reduce((a, b) => a + b, 0) / n : 0;
    case "count":
      return n;
    case "min":
      return n ? Math.min(...values) : 0;
    case "max":
      return n ? Math.max(...values) : 0;
    case "median": {
      if (!n) return 0;
      const s = [...values].sort((a, b) => a - b);
      const mid = Math.floor(n / 2);
      return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }
    case "std": {
      if (n < 2) return 0;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    }
    default:
      return 0;
  }
}

/** Tool "analisis_dataset" -- filter (whitelist operator) + agregasi (whitelist fungsi),
 * BUKAN eval/exec bebas. Ini port dari _analisis_dataset_builder() di common.py, versi
 * TypeScript yang jalan di server request ini (dataset dikirim client per-request, tidak
 * disimpan server -- lihat catatan arsitektur di README.md). */
function analisisDataset(
  rows: Row[],
  columns: string[],
  args: { filters?: Filter[]; kolom_agregasi?: string; fungsi_agregasi?: string; group_by?: string; kolom_unik?: string }
): Record<string, unknown> {
  const filters = (args.filters || []).filter((f) => columns.includes(f.kolom));
  const fungsi = FUNGSI_VALID.has(args.fungsi_agregasi || "") ? (args.fungsi_agregasi as string) : "count";

  const filtered = terapkanFilter(rows, filters);

  if (args.kolom_unik && columns.includes(args.kolom_unik)) {
    const unik = Array.from(new Set(filtered.map((r) => String(r[args.kolom_unik as string])))).slice(0, 100);
    return { jumlah_baris_cocok: filtered.length, jumlah_nilai_unik: unik.length, nilai_unik_sample: unik };
  }

  if (args.group_by && columns.includes(args.group_by)) {
    const groups = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = String(r[args.group_by as string]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const hasil = Array.from(groups.entries())
      .map(([key, grs]) => {
        if (fungsi === "count") return { [args.group_by as string]: key, nilai: grs.length };
        if (fungsi === "nunique" && args.kolom_agregasi) {
          return { [args.group_by as string]: key, nilai: new Set(grs.map((r) => String(r[args.kolom_agregasi as string]))).size };
        }
        const vals = grs.map((r) => Number(r[args.kolom_agregasi || ""])).filter((v) => !isNaN(v));
        return { [args.group_by as string]: key, nilai: agregasi(vals, fungsi) };
      })
      .sort((a, b) => (b.nilai as number) - (a.nilai as number))
      .slice(0, 50);
    return { jumlah_baris_cocok: filtered.length, dikelompokkan_per: args.group_by, fungsi_agregasi: fungsi, hasil };
  }

  if (fungsi === "count") {
    return { jumlah_baris_cocok: filtered.length, sample: filtered.slice(0, 20) };
  }
  if (fungsi === "nunique" && args.kolom_agregasi) {
    const n = new Set(filtered.map((r) => String(r[args.kolom_agregasi as string]))).size;
    return { jumlah_baris_cocok: filtered.length, jumlah_nilai_unik: n };
  }
  if (!args.kolom_agregasi || !columns.includes(args.kolom_agregasi)) {
    return { error: "kolom_agregasi wajib diisi untuk fungsi selain count/nunique.", jumlah_baris_cocok: filtered.length };
  }
  const vals = filtered.map((r) => Number(r[args.kolom_agregasi as string])).filter((v) => !isNaN(v));
  return {
    jumlah_baris_cocok: filtered.length,
    kolom_agregasi: args.kolom_agregasi,
    fungsi_agregasi: fungsi,
    hasil: agregasi(vals, fungsi),
    sample: filtered.slice(0, 10),
  };
}

export async function POST(req: NextRequest) {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  if (auth.role !== "super") {
    return NextResponse.json({ error: "Fitur ini hanya untuk super user." }, { status: 403 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY belum di-set. Lihat README.md." }, { status: 200 });
  }

  const body = await req.json();
  const { messages, columns, numericColumns, rows, fileName } = body as {
    messages: { role: string; content: string }[];
    columns: string[];
    numericColumns: string[];
    rows: Row[];
    fileName: string;
  };

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Belum ada dataset yang diupload." }, { status: 400 });
  }

  const toolDef = {
    type: "function" as const,
    function: {
      name: "analisis_dataset",
      description:
        "Filter & agregasi dataset yang diupload user. WAJIB dipakai untuk menjawab pertanyaan apapun " +
        "tentang isi file (jumlah, total, rata-rata, dsb) -- jangan mengarang jawaban dari ingatan.",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "array",
            description: "Daftar filter (AND), opsional",
            items: {
              type: "object",
              properties: {
                kolom: { type: "string" },
                operator: { type: "string", enum: ["==", "!=", ">", "<", ">=", "<=", "contains"] },
                nilai: { type: "string" },
              },
              required: ["kolom", "operator", "nilai"],
            },
          },
          group_by: { type: "string", description: "Nama kolom untuk dikelompokkan (opsional)" },
          kolom_agregasi: { type: "string", description: "Nama kolom numerik yang diagregasi" },
          fungsi_agregasi: { type: "string", enum: ["sum", "mean", "count", "min", "max", "median", "std", "nunique"] },
          kolom_unik: { type: "string", description: "Kalau user tanya 'apa saja nilai unik kolom X', isi nama kolomnya di sini" },
        },
      },
    },
  };

  const systemPrompt = `Kamu adalah asisten analisis data. User baru saja mengupload file "${fileName}" dengan
${rows.length} baris dan kolom: ${columns.join(", ")}. Kolom numerik yang terdeteksi: ${numericColumns.join(", ") || "(tidak ada)"}.
Jawab dalam Bahasa Indonesia. WAJIB panggil tool analisis_dataset untuk pertanyaan apapun tentang isi data --
jangan pernah mengarang angka. Kalau hasil tool kosong/tidak relevan, katakan jujur.`;

  const conversation = [{ role: "system", content: systemPrompt }, ...messages] as Array<Record<string, unknown>>;

  try {
    for (let i = 0; i < 4; i++) {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: GROQ_MODEL, messages: conversation, tools: [toolDef], tool_choice: "auto" }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        return NextResponse.json({ error: `Groq API error: ${resp.status} ${t.slice(0, 300)}` });
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return NextResponse.json({ error: "Respons Groq tidak dikenali." });

      if (msg.tool_calls?.length > 0) {
        conversation.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            // args kosong kalau parsing gagal
          }
          const hasil = analisisDataset(rows, columns, args);
          conversation.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(hasil) });
        }
        continue;
      }
      return NextResponse.json({ reply: msg.content || "" });
    }
    return NextResponse.json({ error: "Terlalu banyak pemanggilan tool." });
  } catch (e) {
    return NextResponse.json({ error: `Gagal menghubungi Groq: ${(e as Error).message}` });
  }
}
