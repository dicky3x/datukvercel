import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cariAnggaran } from "@/lib/search-data";

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

type ChatMessage = { role: "user" | "assistant" | "system" | "tool"; content: string; tool_call_id?: string; name?: string };

function toolDefinition(scopeKdsatker: number | null) {
  const cakupan =
    scopeKdsatker === null
      ? "Mencari & menjumlahkan pagu/realisasi anggaran di SELURUH data (semua kementerian & satker), "
      : "Mencari & menjumlahkan pagu/realisasi anggaran DI DALAM DATA SATKER INI SAJA (tidak bisa mengakses data satker lain), ";
  return {
    type: "function" as const,
    function: {
      name: "cari_anggaran",
      description:
        cakupan +
        "berdasarkan kata kunci tema/program/kegiatan/output, dan opsional filter provinsi atau tahun. " +
        "WAJIB dipakai untuk pertanyaan yang menyebutkan tema (mis. 'ketahanan pangan', 'kebakaran hutan'), " +
        "lokasi/provinsi tertentu, atau kementerian/satker yang BUKAN yang sedang aktif di dashboard.",
      parameters: {
        type: "object",
        properties: {
          kata_kunci: { type: "array", items: { type: "string" }, description: "Kata kunci tema/program/kegiatan/output" },
          provinsi: { type: "string", description: "Nama provinsi (opsional)" },
          tahun_cari: { type: "integer", description: "Tahun anggaran (opsional, default tahun yang sedang dipilih)" },
        },
      },
    },
  };
}

export async function POST(req: NextRequest) {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Fitur chat AI belum aktif karena GROQ_API_KEY belum di-set. Lihat README.md." },
      { status: 200 }
    );
  }

  const body = await req.json();
  const { messages, ringkasanData, tahunAktif } = body as {
    messages: ChatMessage[];
    ringkasanData: string;
    tahunAktif: number;
  };

  const scopeKdsatker = auth.role === "super" ? null : auth.kdsatker;

  const systemPrompt = `Kamu adalah asisten analisis anggaran pemerintah (DATUK). Jawab dalam Bahasa Indonesia,
ringkas dan berbasis data. Konteks data yang sedang aktif di dashboard:

${ringkasanData}

Kalau pertanyaan menyebut tema, lokasi/provinsi, atau kementerian/satker lain di luar yang sedang aktif,
WAJIB panggil tool cari_anggaran. Kalau tidak ditemukan, katakan jujur "tidak ditemukan" -- jangan mengarang.`;

  const conversation: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...messages];

  try {
    for (let iterasi = 0; iterasi < 4; iterasi++) {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: conversation,
          tools: [toolDefinition(scopeKdsatker)],
          tool_choice: "auto",
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return NextResponse.json({ error: `Groq API error: ${resp.status} ${errText.slice(0, 300)}` }, { status: 200 });
      }

      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return NextResponse.json({ error: "Respons Groq tidak dikenali." }, { status: 200 });

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Sertakan tool_calls di pesan assistant supaya sesuai format OpenAI-compatible
        // yang dipakai Groq (dibutuhkan saat mengirim balasan tool berikutnya).
        conversation.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls } as unknown as ChatMessage);
        for (const tc of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            // biarkan args kosong kalau parsing gagal
          }
          const hasil = await cariAnggaran(args, scopeKdsatker, tahunAktif);
          conversation.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(hasil),
          });
        }
        continue; // panggil lagi Groq dengan hasil tool
      }

      return NextResponse.json({ reply: msg.content || "" });
    }
    return NextResponse.json({ error: "Terlalu banyak pemanggilan tool, coba pertanyaan yang lebih spesifik." });
  } catch (e) {
    return NextResponse.json({ error: `Gagal menghubungi Groq: ${(e as Error).message}` }, { status: 200 });
  }
}
