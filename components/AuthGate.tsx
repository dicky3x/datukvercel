"use client";

import { useEffect, useState } from "react";
import LoginForm from "./LoginForm";
import NavBar from "./NavBar";

export type Auth = { role: "super" | "satker"; kdsatker: number | null };

export default function AuthGate({ children }: { children: (auth: Auth) => React.ReactNode }) {
  const [auth, setAuth] = useState<Auth | null | undefined>(undefined);
  const [open, setOpen] = useState(true);

  // Sidebar: tertutup di HP; di desktop ikut pilihan terakhir pengguna
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("sidebar-open");
    } catch {}
    if (window.innerWidth < 768 || saved === "0") setOpen(false);
  }, []);

  function setSidebar(v: boolean) {
    setOpen(v);
    try {
      localStorage.setItem("sidebar-open", v ? "1" : "0");
    } catch {}
  }

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setAuth(d.auth));
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (auth === undefined) return null;
  if (auth === null) return <LoginForm onSuccess={() => window.location.reload()} />;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <NavBar auth={auth} onLogout={logout} open={open} onClose={() => setSidebar(false)} />
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b bg-white px-3">
          <button
            onClick={() => setSidebar(!open)}
            aria-label={open ? "Sembunyikan sidebar" : "Tampilkan sidebar"}
            aria-expanded={open}
            className="rounded px-2 py-1 text-lg leading-none text-slate-600 hover:bg-slate-100"
          >
            ☰
          </button>
          <span className="text-sm font-medium">DATUK — Dashboard Pagu &amp; Realisasi</span>
        </div>
        {children(auth)}
      </div>
    </div>
  );
}
