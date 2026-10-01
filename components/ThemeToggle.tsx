"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Mengecek apakah sebelumnya user sudah memilih mode gelap
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.body.classList.add("dark-theme");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.body.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <button 
      onClick={toggleTheme}
      style={{
        padding: "8px 16px",
        borderRadius: "8px",
        backgroundColor: "var(--btn-bg, #f1f5f9)",
        color: "var(--text-color, #0f172a)",
        border: "1px solid var(--border-color, #cbd5e1)",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "14px",
        transition: "all 0.3s ease"
      }}
    >
      {isDark ? "☀️ Mode Terang" : "🌙 Mode Gelap"}
    </button>
  );
}