import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { Button } from "@/components/ui/button";

const FRIENDLY_MESSAGES: Record<string, string> = {
  not_allowed:
    "That email isn't on the allowlist. This app is private to two people — if you think this is a mistake, double-check the spelling and try again.",
  missing_code:
    "The sign-in link didn't include a code. Try requesting a fresh magic link.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    (reason && FRIENDLY_MESSAGES[reason]) ||
    reason ||
    "Something went wrong while signing you in.";

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] uppercase tracking-[0.4em] text-burgundy font-medium mb-4">
          Notre Vie à Deux
        </p>
        <h1 className="font-serif text-5xl leading-none text-ink">
          Hold <em>on</em>.
        </h1>
        <Ornament />

        <div className="border border-line bg-paper rounded-[4px] p-8 shadow-soft mt-6">
          <p className="text-sm text-ink leading-relaxed">{message}</p>
        </div>

        <div className="mt-6">
          <Button asChild>
            <Link href="/login">Try again</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
