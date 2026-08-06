"use client";

import { useRouter } from "next/navigation";
import { ROLE_STORAGE_KEY, useWeddingRole } from "@/lib/use-wedding-role";

export function RoleSelector() {
  const router = useRouter();
  const role = useWeddingRole();

  const handleChangeRole = () => {
    localStorage.removeItem(ROLE_STORAGE_KEY);
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
