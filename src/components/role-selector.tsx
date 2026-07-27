"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function RoleSelector() {
  const router = useRouter();
  const [role, setRole] = useState<"bride" | "groom" | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem("wedding-role") as "bride" | "groom" | null;
    setRole(savedRole);
  }, []);

  const handleChangeRole = () => {
    localStorage.removeItem("wedding-role");
    router.push("/");
  };

  if (!role) return null;

  const label = role === "bride" ? "Selver" : "Celal";

  return (
    <button
      type="button"
      onClick={handleChangeRole}
      title="Change who you're viewing as"
      className="whitespace-nowrap rounded-[8px] px-2.5 py-2 text-left text-[13px] tracking-[-0.008em] text-[var(--fg2)] transition-colors hover:bg-[var(--fill)]"
    >
      Viewing as {label}
    </button>
  );
}
