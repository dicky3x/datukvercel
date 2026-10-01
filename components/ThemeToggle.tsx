"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
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
        padding: "10px 20px",
        borderRadius: "8px",
        backgroundColor: "var(--btn-bg)",
        color: "var(--text-color)",
        border: "1px solid var(--border-color)",
        cursor: "pointer",
        fontWeight: "bold",
        transition: "all 0.3s ease"
      }}
    >
      {isDark ? "☀️ Mode Terang" : "🌙 Mode Gelap"}
    </button>
  );
}