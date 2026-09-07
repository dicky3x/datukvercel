export default function KpiCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1 break-words">{value}</div>
      {delta && <div className="text-sm text-emerald-600 mt-1">{delta}</div>}
    </div>
  );
}
