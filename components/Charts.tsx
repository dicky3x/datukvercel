"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { BULAN_KOLOM, rupiah } from "@/lib/format";

const COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

export function MonthlyBarChart({ monthly }: { monthly: number[] }) {
  const data = BULAN_KOLOM.map((b, i) => ({ bulan: b, realisasi: monthly[i] }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bulan" fontSize={12} />
        <YAxis fontSize={11} tickFormatter={(v) => (v / 1e9).toFixed(1) + " M"} />
        <Tooltip formatter={(v) => rupiah(Number(v))} />
        <Bar dataKey="realisasi" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaguVsRealisasi({ pagu, realisasi }: { pagu: number; realisasi: number }) {
  const data = [{ name: "Total", pagu, realisasi }];
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis fontSize={11} tickFormatter={(v) => (v / 1e9).toFixed(1) + " M"} />
        <Tooltip formatter={(v) => rupiah(Number(v))} />
        <Legend />
        <Bar dataKey="pagu" name="Pagu" fill="#64748b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="realisasi" name="Realisasi" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => rupiah(Number(v))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendProyeksiChart({
  monthly,
  totalBulananProyeksi,
  bulanPenuhTerakhirTampilan,
}: {
  monthly: number[];
  totalBulananProyeksi: number[];
  bulanPenuhTerakhirTampilan: number;
}) {
  const data = BULAN_KOLOM.map((b, i) => {
    const bulanKe = i + 1;
    const aktual = bulanKe <= bulanPenuhTerakhirTampilan ? monthly[i] : null;
    let proyeksi: number | null;
    if (bulanPenuhTerakhirTampilan === 0) proyeksi = totalBulananProyeksi[i];
    else if (bulanKe < bulanPenuhTerakhirTampilan) proyeksi = null;
    else if (bulanKe === bulanPenuhTerakhirTampilan) proyeksi = monthly[i];
    else proyeksi = totalBulananProyeksi[i];
    return { bulan: b, Aktual: aktual, Proyeksi: proyeksi };
  });
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bulan" fontSize={12} />
        <YAxis fontSize={11} tickFormatter={(v) => (v / 1e9).toFixed(1) + " M"} />
        <Tooltip formatter={(v) => (v == null ? "-" : rupiah(Number(v)))} />
        <Legend />
        <Line type="monotone" dataKey="Aktual" stroke="#0ea5e9" strokeWidth={3} connectNulls={false} dot={{ r: 3 }} />
        <Line
          type="monotone"
          dataKey="Proyeksi"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="6 4"
          connectNulls
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ConfidenceBarChart({ data }: { data: { label: string; confidence: number }[] }) {
  const withColor = data.map((d) => ({
    ...d,
    fill: d.confidence >= 70 ? "#22c55e" : d.confidence >= 40 ? "#f59e0b" : "#ef4444",
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={withColor}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={11} interval={0} angle={-15} textAnchor="end" height={70} />
        <YAxis domain={[0, 100]} fontSize={11} />
        <Tooltip formatter={(v) => Number(v).toFixed(1)} />
        <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
          {withColor.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
