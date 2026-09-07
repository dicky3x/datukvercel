import { BULAN_KOLOM, rupiah, persen } from "@/lib/format";

type Kategori = { label: string; pagu: number; bulanan: number[]; aktual: number[]; confidence: number | null };

export default function ProjectionTable({
  kategori,
  bulanPenuhTerakhirTampilan,
}: {
  kategori: Kategori[];
  bulanPenuhTerakhirTampilan: number;
}) {
  const paguTotal = kategori.reduce((a, k) => a + k.pagu, 0);
  const aktualTotalPerBulan = BULAN_KOLOM.map((_, i) => kategori.reduce((a, k) => a + k.aktual[i], 0));
  const proyeksiTotalPerBulan = BULAN_KOLOM.map((_, i) => kategori.reduce((a, k) => a + k.bulanan[i], 0));

  const totalAktualSemua = kategori.reduce((a, k) => a + k.aktual.slice(0, bulanPenuhTerakhirTampilan).reduce((x, y) => x + y, 0), 0);
  const totalProyeksiSemua = proyeksiTotalPerBulan.reduce((a, b) => a + b, 0);

  const isBulanProyeksi = (i: number) => i >= bulanPenuhTerakhirTampilan;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left p-2 sticky left-0 bg-slate-100">Baris</th>
            {kategori.map((k) => (
              <th key={k.label} className="text-right p-2 whitespace-nowrap">{k.label}</th>
            ))}
            <th className="text-right p-2 font-semibold">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t font-semibold">
            <td className="p-2 sticky left-0 bg-white">PAGU</td>
            {kategori.map((k) => (
              <td key={k.label} className="text-right p-2">{rupiah(k.pagu)}</td>
            ))}
            <td className="text-right p-2">{rupiah(paguTotal)}</td>
          </tr>
          {BULAN_KOLOM.map((b, i) => (
            <tr key={b} className={"border-t " + (isBulanProyeksi(i) ? "bg-amber-50" : "")}>
              <td className="p-2 sticky left-0 bg-inherit">{b}</td>
              {kategori.map((k) => (
                <td key={k.label} className="text-right p-2">{rupiah(k.bulanan[i])}</td>
              ))}
              <td className="text-right p-2 font-medium">{rupiah(proyeksiTotalPerBulan[i])}</td>
            </tr>
          ))}
          <tr className="border-t">
            <td className="p-2 sticky left-0 bg-white">Total Realisasi (Rp)</td>
            {kategori.map((k) => (
              <td key={k.label} className="text-right p-2">
                {rupiah(k.aktual.slice(0, bulanPenuhTerakhirTampilan).reduce((a, b) => a + b, 0))}
              </td>
            ))}
            <td className="text-right p-2">{rupiah(totalAktualSemua)}</td>
          </tr>
          <tr className="border-t">
            <td className="p-2 sticky left-0 bg-white">Total Realisasi (%)</td>
            {kategori.map((k) => {
              const aktualK = k.aktual.slice(0, bulanPenuhTerakhirTampilan).reduce((a, b) => a + b, 0);
              return (
                <td key={k.label} className="text-right p-2">{k.pagu ? persen((aktualK / k.pagu) * 100) : "-"}</td>
              );
            })}
            <td className="text-right p-2">{paguTotal ? persen((totalAktualSemua / paguTotal) * 100) : "-"}</td>
          </tr>
          <tr className="border-t bg-amber-50">
            <td className="p-2 sticky left-0 bg-amber-50">Total Realisasi + Proyeksi (Rp)</td>
            {kategori.map((k) => (
              <td key={k.label} className="text-right p-2">{rupiah(k.bulanan.reduce((a, b) => a + b, 0))}</td>
            ))}
            <td className="text-right p-2 font-semibold">{rupiah(totalProyeksiSemua)}</td>
          </tr>
          <tr className="border-t bg-amber-50">
            <td className="p-2 sticky left-0 bg-amber-50">Total Realisasi + Proyeksi (%)</td>
            {kategori.map((k) => {
              const totalK = k.bulanan.reduce((a, b) => a + b, 0);
              return <td key={k.label} className="text-right p-2">{k.pagu ? persen((totalK / k.pagu) * 100) : "-"}</td>;
            })}
            <td className="text-right p-2 font-semibold">{paguTotal ? persen((totalProyeksiSemua / paguTotal) * 100) : "-"}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">🟨 Baris/sel berwarna kuning = proyeksi, bukan realisasi aktual.</p>
    </div>
  );
}
