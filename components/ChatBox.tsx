"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatBox({
  ringkasanData,
  tahunAktif,
  dataset = "utama",
}: {
  ringkasanData: string;
  tahunAktif: number;
  dataset?: "utama" | "prioritas" | "strategis" | "tkd";
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    if (!text.trim()) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, ringkasanData, tahunAktif, dataset }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMessages([...next, { role: "assistant", content: data.reply }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-xl p-4 bg-white">
      <h3 className="font-semibold mb-2">💬 Tanya AI tentang data ini</h3>
      <p className="text-xs text-slate-500 mb-3">
        Bisa tanya lintas tema/provinsi/kementerian, tidak terbatas pada filter yang sedang aktif.
      </p>
      <div className="space-y-3 max-h-80 overflow-y-auto mb-3">
        {messages.length === 0 && (
          <button
            className="text-sm text-sky-700 underline"
            onClick={() => send("Buatkan narasi singkat tentang kondisi anggaran ini.")}
          >
            Buatkan narasi otomatis
          </button>
        )}
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
        {loading && <p className="text-sm text-slate-400">Sedang berpikir...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          className="flex-1 border rounded-md px-3 py-2 text-sm"
          placeholder="mis. Berapa pagu ketahanan pangan di Riau?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm" disabled={loading}>
          Kirim
        </button>
      </form>
    </div>
  );
}
