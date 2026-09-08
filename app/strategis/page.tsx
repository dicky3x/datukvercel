"use client";

import AuthGate from "@/components/AuthGate";
import KategoriDashboardPage from "@/components/KategoriDashboardPage";

export default function Page() {
  return <AuthGate>{() => <KategoriDashboardPage dataset="strategis" />}</AuthGate>;
}
