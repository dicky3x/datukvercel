"use client";

import { useEffect, useState, useCallback } from "react";
import KpiCard from "@/components/KpiCard";
import { MonthlyBarChart, PaguVsRealisasi, DonutChart } from "@/components/Charts";
import ChatBox from "@/components/ChatBox";
import { rupiah, persen } from "@/lib/format";

type KategoriData = {
  judul: string;
  icon: string;
  label: string;
  dataset: "prioritas" | "strategis";
  tersedia: boolean;
  tidakAdaUntukSatker?: boolean;
  years?: number[];
  kategoriList?: string[];
  selection?: { tahun: number; kategori: string | null };
  kpi?: { pagu: number; realisasi: number; sisaPagu: number; persenSerapan: number; proyeksiAkhirTahun: number; persenProyeksi: number };
  monthly?: number[];
  komposisiKedua?: { name: string; value: number }[];
  perbandinganKategori?: { kategori: string; pagu: number; realisasi: number; persen: number }[] | null;
  rincian?: {
    kategori: string; nmdept: string; nmsatker: string; kabkota: string; kegiatan: string;
    output: string; suboutput: string; akun: string; pagu: number; realisasi: number; persen: number;
  }[];
};

export default function KategoriDashboardPage({ dataset }: { dataset: "prioritas" | "strategis" }) {
  const [data, setData] = useState<KategoriData | null>(null);
  const [tahun, setTahun] = useState<number | null>(null);
  const [kategori, setKategori] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ dataset });
    if (tahun) params.set("tahun", String(tahun));
    if (kategori) params.set("kategori", kategori);
    const res = await fetch(`/api/kategori?${params.toString()}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const d = await res.json();
    setData(d);
    if (!tahun && d.selection) setTahun(d.selection.tahun);
  }, [dataset, tahun, kategori]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <div className="p-8 text-slate-500">Memuat data...</div>;

  if (data.tidakAdaUntukSatker) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <p className="bg-sky-50 text-sky-700 rounded-md p-4">
          Satker Anda tidak memiliki anggaran terkait {data.label.toLowerCase()}.
        </p>
      </div>
    );
  }

  const { kpi, monthly, komposisiKedua, perbandinganKategori, rincian, selection } = data;
  const label = data.label;

  const ringkasanUntukAI = kpi
    ? [
        `Data ${label}:`,
        `- Cakupan: ${selection?.kategori || `Semua ${label}`}`,
        `- Tahun: ${selection?.tahun}`,
        `- Pagu: ${rupiah(kpi.pagu)}`,
        `- Realisasi: ${rupiah(kpi.realisasi)} (${persen(kpi.persenSerapan)} dari pagu)`,
        `- Sisa pagu: ${rupiah(kpi.sisaPagu)}`,
        `- Proyeksi akhir tahun: ${rupiah(kpi.proyeksiAkhirTahun)} (${persen(kpi.persenProyeksi)} dari pagu)`,
      ].join("\n")
    : "";

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      <aside className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-medium text-sm">Filter</h3>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tahun</label>
            <select
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              value={tahun ?? selection?.tahun}
              onChange={(e) => {
                setTahun(parseInt(e.target.value, 10));
                setKategori(null);
              }}
            >
              {data.years?.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{label}</label>
            <select
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              value={kategori ?? ""}
              onChange={(e) => setKategori(e.target.value || null)}
            >
              <option value="">— Semua {label} —</option>
              {data.kategoriList?.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{data.icon} {data.judul}</h1>
          <p className="text-sm text-slate-500">{selection?.kategori || `Semua ${label}`} — Tahun {selection?.tahun}</p>
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
          <div className="bg-white rounded-xl shadow-sm p-4 lg:col-span-3">
            <h3 className="font-medium mb-2">Realisasi per Bulan</h3>
            {monthly && <MonthlyBarChart monthly={monthly} />}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 lg:col-span-2">
            <h3 className="font-medium mb-2">Pagu vs Realisasi</h3>
            {kpi && <PaguVsRealisasi pagu={kpi.pagu} realisasi={kpi.realisasi} />}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
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
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-medium mb-2">{selection?.kategori ? "Realisasi per Kabupaten/Kota" : `Realisasi per ${label}`}</h3>
            {komposisiKedua && <DonutChart data={komposisiKedua} />}
          </div>
        </div>

        {perbandinganKategori && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-medium mb-3">Perbandingan antar {label}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="p-2">{label}</th>
                    <th className="p-2 text-right">Pagu</th>
                    <th className="p-2 text-right">Realisasi</th>
                    <th className="p-2 text-right">% Realisasi</th>
                  </tr>
                </thead>
                <tbody>
                  {perbandinganKategori.map((k) => (
                    <tr key={k.kategori} className="border-t">
                      <td className="p-2">{k.kategori}</td>
                      <td className="p-2 text-right">{rupiah(k.pagu)}</td>
                      <td className="p-2 text-right">{rupiah(k.realisasi)}</td>
                      <td className="p-2 text-right">{persen(k.persen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium mb-3">Rincian {label}</h3>
          <div className="overflow-x-auto max-h-[420px]">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-100">
                <tr className="text-left">
                  {!selection?.kategori && <th className="p-2">Kategori</th>}
                  <th className="p-2">Satker</th>
                  <th className="p-2">Kab/Kota</th>
                  <th className="p-2">Kegiatan</th>
                  <th className="p-2">Output</th>
                  <th className="p-2">Suboutput</th>
                  <th className="p-2">Akun</th>
                  <th className="p-2 text-right">Pagu</th>
                  <th className="p-2 text-right">Realisasi</th>
                  <th className="p-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {rincian?.map((r, i) => (
                  <tr key={i} className="border-t">
                    {!selection?.kategori && <td className="p-2">{r.kategori}</td>}
                    <td className="p-2">{r.nmsatker}</td>
                    <td className="p-2">{r.kabkota}</td>
                    <td className="p-2">{r.kegiatan}</td>
                    <td className="p-2">{r.output}</td>
                    <td className="p-2">{r.suboutput}</td>
                    <td className="p-2">{r.akun}</td>
                    <td className="p-2 text-right">{rupiah(r.pagu)}</td>
                    <td className="p-2 text-right">{rupiah(r.realisasi)}</td>
                    <td className="p-2 text-right">{persen(r.persen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">Diurutkan dari pagu terbesar, dibatasi maks. 300 baris.</p>
        </div>

        <ChatBox ringkasanData={ringkasanUntukAI} tahunAktif={selection?.tahun || new Date().getFullYear()} dataset={dataset} />
      </main>
    </div>
  );
}
