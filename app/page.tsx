"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGate, { Auth } from "@/components/AuthGate";
import KpiCard from "@/components/KpiCard";
import { MonthlyBarChart, PaguVsRealisasi, DonutChart, TrendProyeksiChart, ConfidenceBarChart } from "@/components/Charts";
import ProjectionTable from "@/components/ProjectionTable";
import EarlyWarning from "@/components/EarlyWarning";
import ChatBox from "@/components/ChatBox";
import ThemeToggle from "@/components/ThemeToggle"; // <-- IMPORT TOMBOL TEMA DI SINI
import { rupiah, persen } from "@/lib/format";

type DashboardData = {
  isSuper: boolean;
  years: number[];
  deptOptions: { kddept: number; nmdept: string; label: string }[];
  satkerOptions: { kdsatker: number; nmsatker: string; label: string }[];
  selection: { tahun: number; kddept: number | null; kdsatker: number | null; nmdept?: string; nmsatker?: string };
  empty?: boolean;
  kpi?: {
    pagu: number; realisasi: number; sisaPagu: number; blokir: number;
    persenSerapan: number; proyeksiAkhirTahun: number; persenProyeksi: number;
    confidenceKeseluruhan: number | null;
  };
  monthly?: number[];
  jenisBelanja?: { label: string; realisasi: number }[];
  bulanPenuhTerakhir?: number;
  proyeksi?: {
    totalBulanan: number[];
    kategori: { label: string; pagu: number; bulanan: number[]; aktual: number[]; confidence: number | null }[];
  };
  earlyWarning?: { skorRisiko: number; kategoriRisiko: string; peringatan: { tingkat: string; jenis: string; kategori: string; alasan: string }[] };
};

export default function Home() {
  return <AuthGate>{(auth) => <DashboardUtama auth={auth} />}</AuthGate>;
}

function DashboardUtama({ auth }: { auth: Auth }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tahun, setTahun] = useState<number | null>(null);
  const [kddept, setKddept] = useState<number | null | "ALL">(null);
  const [kdsatker, setKdsatker] = useState<number | null | "ALL">(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (tahun) params.set("tahun", String(tahun));
    if (kddept && kddept !== "ALL") params.set("kddept", String(kddept));
    if (kdsatker && kdsatker !== "ALL") params.set("kdsatker", String(kdsatker));
    const res = await fetch(`/api/dashboard?${params.toString()}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const d = await res.json();
    setData(d);
    if (!tahun) setTahun(d.selection.tahun);
  }, [tahun, kddept, kdsatker]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <div className="p-8 text-slate-500">Memuat data...</div>;

  const isSuper = data.isSuper;

  if (data.empty) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <p className="text-amber-700 bg-amber-50 rounded-md p-4">
          Tidak ada data untuk entitas ini pada tahun {data.selection.tahun}.
        </p>
      </div>
    );
  }

  const { kpi, monthly, jenisBelanja, proyeksi, earlyWarning, bulanPenuhTerakhir } = data;

  const now = new Date();
  const bulanKalenderBerjalan =
    data.selection.tahun < now.getFullYear() ? 13 : data.selection.tahun > now.getFullYear() ? 1 : now.getMonth() + 1;
  const bulanPenuhTerakhirTampilan = Math.max(
    Math.min((bulanPenuhTerakhir ?? 0) + 1, bulanKalenderBerjalan) - 1,
    0
  );

  const ringkasanUntukAI = kpi
    ? [
        `Data satker:`,
        `- Kementerian/Lembaga: ${data.selection.nmdept}`,
        `- Satker: ${data.selection.nmsatker}`,
        `- Tahun: ${data.selection.tahun}`,
        `- Pagu: ${rupiah(kpi.pagu)}`,
        `- Realisasi: ${rupiah(kpi.realisasi)} (${persen(kpi.persenSerapan)} dari pagu)`,
        `- Sisa pagu: ${rupiah(kpi.sisaPagu)}`,
        `- Proyeksi akhir tahun: ${rupiah(kpi.proyeksiAkhirTahun)} (${persen(kpi.persenProyeksi)} dari pagu)`,
        `- 3 jenis belanja terbesar: ${(jenisBelanja || [])
          .slice(0, 3)
          .map((j) => `${j.label}${rupiah(j.realisasi)}`)
          .join(", ")}`,
      ].join("\n")
    : "";

  return (
    {/* KUNCI LAYOUT: w-full, max-w-[100vw], dan overflow-x-hidden mengunci halaman agar tidak bisa digeser ke samping */}
    <div className="w-full max-w-[100vw] overflow-x-hidden mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        
        {/* Sidebar filter */}
        <aside className="space-y-4">
          {/* Tambahkan var(--bg-color) agar mengikuti warna tema dari CSS jika Tailwind tidak tersetting Dark Mode */}
          <div className="rounded-xl shadow-sm p-4 space-y-3 border" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
            <h3 className="font-medium text-sm">Filter</h3>
            <div>
              <label className="block text-xs opacity-75 mb-1">Tahun</label>
              <select
                className="w-full border rounded-md px-2 py-1.5 text-sm"
                style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                value={tahun ?? data.selection.tahun}
                onChange={(e) => {
                  setTahun(parseInt(e.target.value, 10));
                  setKddept(null);
                  setKdsatker(null);
                }}
              >
                {data.years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {isSuper && (
              <>
                <div>
                  <label className="block text-xs opacity-75 mb-1">Kementerian/Lembaga</label>
                  <select
                    className="w-full border rounded-md px-2 py-1.5 text-sm"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                    value={kddept ?? "ALL"}
                    onChange={(e) => {
                      const v = e.target.value === "ALL" ? "ALL" : parseInt(e.target.value, 10);
                      setKddept(v);
                      setKdsatker(null);
                    }}
                  >
                    <option value="ALL">— Semua Kementerian/Lembaga —</option>
                    {data.deptOptions.map((d) => (
                      <option key={d.kddept} value={d.kddept}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs opacity-75 mb-1">Satuan Kerja</label>
                  <select
                    className="w-full border rounded-md px-2 py-1.5 text-sm"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                    value={kdsatker ?? "ALL"}
                    onChange={(e) => setKdsatker(e.target.value === "ALL" ? "ALL" : parseInt(e.target.value, 10))}
                  >
                    <option value="ALL">— Semua Satker —</option>
                    {data.satkerOptions.map((s) => (
                      <option key={s.kdsatker} value={s.kdsatker}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {!isSuper && (
              <div className="text-xs opacity-75 space-y-1">
                <p>Satker: <b>{data.selection.nmsatker}</b></p>
                <p>Kementerian/Lembaga: {data.selection.nmdept}</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="space-y-6 w-full overflow-x-hidden">
          {/* HEADER DENGAN TOMBOL THEME */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold">📊 Dashboard Pagu &amp; Realisasi</h1>
              <p className="text-sm opacity-75">
                {data.selection.nmdept} — {data.selection.nmsatker} — Tahun {data.selection.tahun}
              </p>
            </div>
            {/* TOMBOL DIPANGGIL DI SINI */}
            <ThemeToggle />
          </div>

          {kpi && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard label="Pagu" value={rupiah(kpi.pagu)} />
              <KpiCard label="Realisasi" value={rupiah(kpi.realisasi)} delta={`${persen(kpi.persenSerapan)} dari pagu`} />
              <KpiCard label="Sisa Pagu" value={rupiah(kpi.sisaPagu)} />
              <KpiCard
                label="Proyeksi Realisasi Akhir Tahun"
                value={rupiah(kpi.proyeksiAkhirTahun)}
                delta={`${persen(kpi.persenProyeksi)} dari pagu`}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="rounded-xl shadow-sm p-4 lg:col-span-3 border" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
              <h3 className="font-medium mb-2">Realisasi per Bulan</h3>
              {monthly && <MonthlyBarChart monthly={monthly} />}
            </div>
            <div className="rounded-xl shadow-sm p-4 lg:col-span-2 border" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
              <h3 className="font-medium mb-2">Pagu vs Realisasi</h3>
              {kpi && <PaguVsRealisasi pagu={kpi.pagu} realisasi={kpi.realisasi} />}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl shadow-sm p-4 border" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
              <h3 className="font-medium mb-2">Realisasi vs Sisa Pagu</h3>
              {kpi && (
                <DonutChart
                  data={[
                    { name: "Realisasi", value: kpi.realisasi },
                    { name: "Sisa Pagu", value: Math.max(kpi.sisaPagu, 0) },
                  ]}
                />
              )}
            </div>
            <div className="rounded-xl shadow-sm p-4 border" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
              <h3 className="font-medium mb-2">Realisasi per Jenis Belanja</h3>
              {jenisBelanja && (
                <DonutChart data={jenisBelanja.map((j) => ({ name: j.label, value: j.realisasi }))} />
              )}
            </div>
          </div>

          <div className="rounded-xl shadow-sm p-4 border" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
            <h3 className="font-medium mb-2">Tren &amp; Proyeksi Realisasi hingga Akhir Tahun</h3>
            {monthly && proyeksi && (
              <TrendProyeksiChart
                monthly={monthly}
                totalBulananProyeksi={proyeksi.totalBulanan}
                bulanPenuhTerakhirTampilan={bulanPenuhTerakhirTampilan}
              />
            )}
            <p className="text-xs opacity-75">Grafik ini menampilkan realisasi tiap bulan (bukan kumulatif).</p>
          </div>

          {/* KUNCI TABEL: overflow-x-auto ditambahkan di tabel ini */}
          <div className="rounded-xl shadow-sm p-4 border w-full overflow-x-auto" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
            <h3 className="font-medium mb-3">Realisasi Bulanan per Jenis Belanja</h3>
            {proyeksi && (
              <div className="table-responsive">
                <ProjectionTable kategori={proyeksi.kategori} bulanPenuhTerakhirTampilan={bulanPenuhTerakhirTampilan} />
              </div>
            )}
          </div>

          {proyeksi && proyeksi.kategori.some((k) => k.confidence !== null) && (
            <div className="rounded-xl shadow-sm p-4 border" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
              <h3 className="font-medium mb-2">Skor Keyakinan Proyeksi per Jenis Belanja</h3>
              <ConfidenceBarChart
                data={proyeksi.kategori
                  .filter((k) => k.confidence !== null)
                  .map((k) => ({ label: k.label, confidence: k.confidence as number }))}
              />
            </div>
          )}

          <div className="rounded-xl shadow-sm p-4 border" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
            <h3 className="font-medium mb-3">⚠️ Early Warning</h3>
            {earlyWarning && (
              <EarlyWarning
                skorRisiko={earlyWarning.skorRisiko}
                kategoriRisiko={earlyWarning.kategoriRisiko}
                peringatan={earlyWarning.peringatan}
              />
            )}
          </div>

          <ChatBox ringkasanData={ringkasanUntukAI} tahunAktif={data.selection.tahun} />
        </main>
    </div>
  );
}