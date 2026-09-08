"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Auth = { role: "super" | "satker"; kdsatker: number | null };

const LINKS = [
  { href: "/", label: "📊 Utama" },
  { href: "/prioritas", label: "⭐ Prioritas Presiden" },
  { href: "/strategis", label: "🎯 Program Strategis" },
  { href: "/tkd", label: "🏘️ Transfer ke Daerah", superOnly: true },
  { href: "/dekon-tp", label: "🏢 Dekon & TP" },
  { href: "/upload", label: "📁 Upload Dataset", superOnly: true },
];

export default function NavBar({ auth, onLogout }: { auth: Auth; onLogout: () => void }) {
  const pathname = usePathname();
  const isSuper = auth.role === "super";

  return (
    <div className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto">
        {LINKS.filter((l) => !l.superOnly || isSuper).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={
              "px-3 py-3 text-sm whitespace-nowrap border-b-2 " +
              (pathname === l.href ? "border-slate-900 font-medium" : "border-transparent text-slate-500 hover:text-slate-800")
            }
          >
            {l.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-3 pl-3">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {isSuper ? "Super User" : `Satker ${String(auth.kdsatker).padStart(6, "0")}`}
          </span>
          <button onClick={onLogout} className="text-xs text-slate-500 underline whitespace-nowrap">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
