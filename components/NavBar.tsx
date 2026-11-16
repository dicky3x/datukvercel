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

export default function NavBar({
  auth,
  onLogout,
  open,
  onClose,
}: {
  auth: Auth;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const isSuper = auth.role === "super";

  return (
    <>
      {/* Latar gelap di HP saat sidebar terbuka */}
      {open && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={onClose} aria-hidden />}

      <aside
        aria-label="Menu utama"
        className={
          "fixed md:sticky top-0 left-0 z-30 h-screen shrink-0 overflow-hidden bg-white transition-[width] duration-200 " +
          (open ? "w-64 border-r" : "w-0")
        }
      >
        <div className="flex h-full w-64 flex-col">
          <div className="flex h-12 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">DATUK</span>
            <button
              onClick={onClose}
              aria-label="Tutup sidebar"
              className="rounded px-2 py-1 text-slate-500 hover:text-slate-800"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            {LINKS.filter((l) => !l.superOnly || isSuper).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => {
                  if (window.innerWidth < 768) onClose();
                }}
                className={
                  "block rounded-md px-3 py-2 text-sm " +
                  (pathname === l.href
                    ? "bg-slate-100 font-medium"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="border-t p-4">
            <div className="text-xs text-slate-500">
              {isSuper ? "Super User" : `Satker ${String(auth.kdsatker).padStart(6, "0")}`}
            </div>
            <button onClick={onLogout} className="mt-1 text-xs text-slate-500 underline">
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
