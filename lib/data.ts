import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BULAN_KOLOM } from "./format";

export type AggRow = {
  TAHUN: number;
  KDDEPT: number;
  NMDEPT: string;
  KDSATKER: number;
  NMSATKER: string;
  JENIS_BELANJA: string;
  LABEL_JENIS_BELANJA: string;
  PAGU: number;
  REALISASI: number;
  SISA_PAGU: number;
  BLOKIR: number;
  [bulan: string]: number | string;
};

let cache: AggRow[] | null = null;

/** Data agregat (TAHUN x KDDEPT x KDSATKER x JENIS BELANJA) -- dipakai untuk
 * seluruh KPI & grafik dashboard. Dibuat saat build lewat scripts/prepare-data.mjs,
 * jadi tidak perlu parse ulang CSV mentah di tiap request. */
export function getAggregatedData(): AggRow[] {
  if (cache) return cache;
  const p = path.join(process.cwd(), "data", "aggregated.json");
  const raw = readFileSync(p, "utf-8");
  cache = JSON.parse(raw) as AggRow[];
  return cache;
}

export function getYears(): number[] {
  const s = new Set(getAggregatedData().map((r) => r.TAHUN));
  return Array.from(s).sort((a, b) => b - a);
}

export function getSatkerKodeSet(): Set<number> {
  return new Set(getAggregatedData().map((r) => r.KDSATKER));
}

export function monthSum(rows: AggRow[]): number[] {
  return BULAN_KOLOM.map((b) => rows.reduce((acc, r) => acc + (Number(r[b]) || 0), 0));
}
