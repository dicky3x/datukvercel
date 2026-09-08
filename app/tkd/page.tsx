"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGate, { Auth } from "@/components/AuthGate";
import KpiCard from "@/components/KpiCard";
import { MonthlyBarChart, PaguVsRealisasi, DonutChart } from "@/components/Charts";
import ChatBox from "@/components/ChatBox";
import { rupiah, persen } from "@/lib/format";

type TkdData = {
  error?: string;
  years: number[];
  kabkotaList: string[];
  selection: { tahun: number; kabkota: string | null };
  kpi: { pagu: number; realisasi: number; sisaPagu: number; persenSerapan: number; proyeksiAkhirTahun: number; persenProyeksi: number };
  monthly: number[];
  jenisTkd: { name: string; value: number }[];
  perbandinganWilayah: { kabkota: string; pagu: number; realisasi: number; persen: number }[] | null;
  rincianJenisWilayah: { jenis: string; pagu: number; realisasi: number; sisaPagu: number; persen: number }[] | null;
};

export default function Page() {
  return <AuthGate>{(auth) => <TkdContent auth={auth} />}</AuthGate>;
}

function TkdContent({ auth }: { auth: Auth }) {
  const [data, setData] = useState<TkdData | null>(null);
  const [tahun, setTahun] = useState<number | null>(null);
  const [kabkota, setKabkota] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (tahun) params.set("tahun", String(tahun));
    if (kabkota) params.set("kabkota", kabkota);
    const res = await fetch(`/api/tkd?${params.toString()}`);
    if (res.status === 401) {
      window.location.reload();
      return;
    }
    const d = await res.json();
    setData(d);
    if (!tahun && d.selection) setTahun(d.selection.tahun);
  }, [tahun, kabkota]);

  useEffect(() => {
    load();
  }, [load]);

  if (auth.role !== "super") {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <p className="bg-red-50 text-red-700 rounded-md p-4">Halaman ini hanya bisa diakses oleh super user.</p>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-slate-500">Memuat data...</div>;
  if (data.error) return <div className="p-8 text-red-600">{data.error}</div>;

  const { kpi, monthly, jenisTkd, perbandinganWilayah, rincianJenisWilayah, selection } = data;

  const ringkasanUntukAI = [
    `Data Transfer ke Daerah (TKD):`,
    `- Wilayah: ${selection.kabkota || "Semua Kabupaten/Kota"}`,
    `- Tahun: ${selection.tahun}`,
    `- Pagu: ${rupiah(kpi.pagu)}`,
    `- Realisasi: ${rupiah(kpi.realisasi)} (${persen(kpi.persenSerapan)} dari pagu)`,
    `- Sisa pagu: ${rupiah(kpi.sisaPagu)}`,
    `- Proyeksi akhir tahun: ${rupiah(kpi.proyeksiAkhirTahun)} (${persen(kpi.persenProyeksi)} dari pagu)`,
  ].join("\n");

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      <aside className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-medium text-sm">Filter</h3>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tahun</label>
            <select
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              value={tahun ?? selection.tahun}
              onChange={(e) => {
                setTahun(parseInt(e.target.value, 10));
                setKabkota(null);
              }}
            >
              {data.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Kabupaten/Kota</label>
            <select
              className="w-full border rounded-md px-2 py-1.5 text-sm"
              value={kabkota ?? ""}
              onChange={(e) => setKabkota(e.target.value || null)}
            >
              <option value="">— Semua Kabupaten/Kota —</option>
              {data.kabkotaList.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      <main className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">🏘️ Dashboard Dana Transfer ke Daerah (TKD)</h1>
          <p className="text-sm text-slate-500">{selection.kabkota || "Semua Kabupaten/Kota"} — Tahun {selection.tahun}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard label="Pagu TKD" value={rupiah(kpi.pagu)} />
          <KpiCard label="Realisasi" value={rupiah(kpi.realisasi)} delta={`${persen(kpi.persenSerapan)} dari pagu`} />
          <KpiCard label="Sisa Pagu" value={rupiah(kpi.sisaPagu)} />
          <KpiCard
            label="Proyeksi Realisasi Akhir Tahun"
            value={rupiah(kpi.proyeksiAkhirTahun)}
            delta={`${persen(kpi.persenProyeksi)} dari pagu`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 lg:col-span-3">
            <h3 className="font-medium mb-2">Realisasi per Bulan</h3>
            <MonthlyBarChart monthly={monthly} />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 lg:col-span-2">
            <h3 className="font-medium mb-2">Pagu vs Realisasi</h3>
            <PaguVsRealisasi pagu={kpi.pagu} realisasi={kpi.realisasi} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-medium mb-2">Realisasi vs Sisa Pagu</h3>
            <DonutChart data={[{ name: "Realisasi", value: kpi.realisasi }, { name: "Sisa Pagu", value: Math.max(kpi.sisaPagu, 0) }]} />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-medium mb-2">Realisasi per Jenis TKD</h3>
            <DonutChart data={jenisTkd} />
          </div>
        </div>

        {perbandinganWilayah && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-medium mb-3">Perbandingan antar Kabupaten/Kota</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="p-2">Kabupaten/Kota</th>
                    <th className="p-2 text-right">Pagu</th>
                    <th className="p-2 text-right">Realisasi</th>
                    <th className="p-2 text-right">% Realisasi</th>
                  </tr>
                </thead>
                <tbody>
                  {perbandinganWilayah.map((w) => (
                    <tr key={w.kabkota} className="border-t">
                      <td className="p-2">{w.kabkota}</td>
                      <td className="p-2 text-right">{rupiah(w.pagu)}</td>
                      <td className="p-2 text-right">{rupiah(w.realisasi)}</td>
                      <td className="p-2 text-right">{persen(w.persen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rincianJenisWilayah && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-medium mb-3">Rincian per Jenis Belanja — {selection.kabkota}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="p-2">Jenis Belanja</th>
                    <th className="p-2 text-right">Pagu</th>
                    <th className="p-2 text-right">Realisasi</th>
                    <th className="p-2 text-right">% Realisasi</th>
                    <th className="p-2 text-right">Sisa Pagu</th>
                  </tr>
                </thead>
                <tbody>
                  {rincianJenisWilayah.map((j) => (
                    <tr key={j.jenis} className="border-t">
                      <td className="p-2">{j.jenis}</td>
                      <td className="p-2 text-right">{rupiah(j.pagu)}</td>
                      <td className="p-2 text-right">{rupiah(j.realisasi)}</td>
                      <td className="p-2 text-right">{persen(j.persen)}</td>
                      <td className="p-2 text-right">{rupiah(j.sisaPagu)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <ChatBox ringkasanData={ringkasanUntukAI} tahunAktif={selection.tahun} dataset="tkd" />
      </main>
    </div>
  );
}
