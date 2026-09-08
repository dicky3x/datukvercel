"use client";

import { useRef, useState } from "react";

type ParsedDataset = {
  fileName: string;
  columns: string[];
  numericColumns: string[];
  rowCount: number;
  truncated: boolean;
  rows: Record<string, string | number>[];
};

type Msg = { role: "user" | "assistant"; content: string };

export default function DatasetUpload() {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    setDataset(null);
    setMessages([]);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload-parse", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) {
        setUploadError(d.error || "Gagal memproses file.");
      } else {
        setDataset(d);
      }
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function sendChat(text: string) {
    if (!text.trim() || !dataset) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch("/api/chat-dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          columns: dataset.columns,
          numericColumns: dataset.numericColumns,
          rows: dataset.rows,
          fileName: dataset.fileName,
        }),
      });
      const d = await res.json();
      if (d.error) setChatError(d.error);
      else setMessages([...next, { role: "assistant", content: d.reply }]);
    } catch (e) {
      setChatError((e as Error).message);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">📁 Upload Dataset &amp; Tanya AI</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload file CSV/TSV bebas (struktur apapun), lalu tanya AI tentang isinya. Data hanya diproses
          untuk sesi ini -- tidak disimpan permanen di server (lihat README.md untuk detail arsitektur).
        </p>
      </div>

      <div className="bg-amber-50 text-amber-800 text-sm rounded-md p-3">
        ⚠️ Saat ini hanya format <b>CSV/TSV</b> yang didukung. Excel (.xlsx) sengaja belum didukung karena
        parser Excel yang tersedia untuk Node.js (paket <code>xlsx</code>/SheetJS di npm) punya kerentanan
        keamanan yang belum ada perbaikannya. Kalau file Anda masih .xlsx, silakan buka di Excel/Google
        Sheets lalu "Save As" / "Download" sebagai CSV terlebih dahulu.
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.tsv,.txt"
          className="text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        {uploading && <p className="text-sm text-slate-500 mt-2">Memproses file...</p>}
        {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
      </div>

      {dataset && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-4 text-sm">
            <p>
              <b>{dataset.fileName}</b> — {dataset.rowCount.toLocaleString("id-ID")} baris,{" "}
              {dataset.columns.length} kolom
              {dataset.truncated && (
                <span className="text-amber-600"> (dipotong ke {dataset.rowCount.toLocaleString("id-ID")} baris pertama)</span>
              )}
            </p>
            <p className="text-slate-500 mt-1">Kolom: {dataset.columns.join(", ")}</p>
            <p className="text-slate-500">
              Kolom numerik terdeteksi: {dataset.numericColumns.join(", ") || "(tidak ada)"}
            </p>
            <div className="overflow-x-auto mt-3 max-h-64">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {dataset.columns.map((c) => (
                      <th key={c} className="p-1.5 text-left whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t">
                      {dataset.columns.map((c) => (
                        <td key={c} className="p-1.5 whitespace-nowrap">{String(r[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-1">Preview 10 baris pertama.</p>
          </div>

          <div className="border rounded-xl p-4 bg-white">
            <h3 className="font-semibold mb-2">💬 Tanya AI tentang dataset ini</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto mb-3">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <span
                    className={
                      "inline-block rounded-lg px-3 py-2 text-sm max-w-[90%] whitespace-pre-wrap " +
                      (m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800")
                    }
                  >
                    {m.content}
                  </span>
                </div>
              ))}
              {chatLoading && <p className="text-sm text-slate-400">Sedang berpikir...</p>}
              {chatError && <p className="text-sm text-red-600">{chatError}</p>}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChat(input);
              }}
              className="flex gap-2"
            >
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="mis. Berapa total kolom X untuk kategori Y?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm" disabled={chatLoading}>
                Kirim
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
