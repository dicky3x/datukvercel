"use client";

import { useEffect, useState } from "react";
import LoginForm from "./LoginForm";
import NavBar from "./NavBar";

export type Auth = { role: "super" | "satker"; kdsatker: number | null };

export default function AuthGate({ children }: { children: (auth: Auth) => React.ReactNode }) {
  const [auth, setAuth] = useState<Auth | null | undefined>(undefined);

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
    <div className="min-h-screen bg-slate-50">
      <NavBar auth={auth} onLogout={logout} />
      {children(auth)}
    </div>
  );
}
