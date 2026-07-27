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

  const emoji = role === "bride" ? "👰" : "🤵";
  const label = role === "bride" ? "Bride" : "Groom";

  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-ink-soft">Viewing as</span>
      <button
        onClick={handleChangeRole}
        className="flex items-center gap-2 px-3 py-2 rounded-[4px] border border-line hover:border-burgundy hover:bg-burgundy/5 transition-colors font-sans text-[13px] font-medium"
      >
        <span>{emoji}</span>
        <span>{label}</span>
      </button>
    </div>
  );
}
