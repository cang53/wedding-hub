"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"bride" | "groom" | null>(null);

  const handleSelection = (role: "bride" | "groom") => {
    localStorage.setItem("wedding-role", role);
    setSelectedRole(role);
    // Small delay for animation, then redirect
    setTimeout(() => {
      router.push("/dashboard");
    }, 200);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream p-6">
      <div className="text-center mb-16">
        <h1 className="font-serif text-[48px] sm:text-[64px] font-normal leading-none tracking-[-0.01em] mb-4">
          Celal <em>&</em> Selver
        </h1>
        <p className="text-ink-soft text-[16px] sm:text-[18px]">
          September 5, 2026
        </p>
      </div>

      <div className="max-w-[600px] w-full">
        <p className="text-center text-ink mb-12 text-[16px]">
          Welcome to your wedding planning hub. Are you...
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Bride Option */}
          <button
            onClick={() => handleSelection("bride")}
            disabled={selectedRole !== null}
            className={`
              relative p-8 sm:p-10 rounded-[4px] border-2 transition-all duration-200
              ${
                selectedRole === "bride"
                  ? "border-burgundy bg-burgundy/5 scale-105"
                  : selectedRole === "groom"
                    ? "border-line opacity-50 cursor-not-allowed"
                    : "border-line hover:border-burgundy hover:bg-burgundy/5 cursor-pointer"
              }
            `}
          >
            <div className="text-[48px] mb-3">👰</div>
            <h2 className="font-serif text-[28px] font-normal mb-2 text-ink">
              The Bride
            </h2>
            <p className="text-ink-soft text-[14px]">
              Let&rsquo;s plan your big day
            </p>
            {selectedRole === "bride" && (
              <div className="mt-4 text-burgundy text-[14px] font-medium">
                Selected ✓
              </div>
            )}
          </button>

          {/* Groom Option */}
          <button
            onClick={() => handleSelection("groom")}
            disabled={selectedRole !== null}
            className={`
              relative p-8 sm:p-10 rounded-[4px] border-2 transition-all duration-200
              ${
                selectedRole === "groom"
                  ? "border-sage bg-sage/5 scale-105"
                  : selectedRole === "bride"
                    ? "border-line opacity-50 cursor-not-allowed"
                    : "border-line hover:border-sage hover:bg-sage/5 cursor-pointer"
              }
            `}
          >
            <div className="text-[48px] mb-3">🤵</div>
            <h2 className="font-serif text-[28px] font-normal mb-2 text-ink">
              The Groom
            </h2>
            <p className="text-ink-soft text-[14px]">
              Let&rsquo;s plan our future together
            </p>
            {selectedRole === "groom" && (
              <div className="mt-4 text-sage text-[14px] font-medium">
                Selected ✓
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="mt-16 text-center text-ink-soft text-[13px] max-w-[400px]">
        <p>
          Both of you share and collaborate on all planning decisions. Your
          choice just personalizes your experience.
        </p>
      </div>
    </div>
  );
}
