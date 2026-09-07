export const BULAN_KOLOM = [
  "JAN", "FEB", "MAR", "APR", "MEI", "JUN",
  "JUL", "AGS", "SEP", "OKT", "NOV", "DES",
] as const;

export const BULAN_LABEL: Record<number, string> = Object.fromEntries(
  BULAN_KOLOM.map((b, i) => [i + 1, b])
);

export function fmtSatker(kode: number | null | undefined): string {
  if (kode === null || kode === undefined) return "-";
  return String(kode).padStart(6, "0");
}

export function fmtDept(kode: number | null | undefined): string {
  if (kode === null || kode === undefined) return "-";
  return String(kode).padStart(3, "0");
}

export function rupiah(v: number): string {
  const rounded = Math.round(v);
  return "Rp " + rounded.toLocaleString("id-ID");
}

export function persen(v: number): string {
  return v.toFixed(1) + "%";
}

export const LABEL_BELANJA_PEGAWAI = "Belanja Pegawai";
