import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { Button } from "@/components/ui/button";

const FRIENDLY_MESSAGES: Record<string, string> = {
  not_allowed:
    "That sign-in link is no longer needed. Head back to the app and continue from there.",
  missing_code:
    "That sign-in link is incomplete. Head back to the app and start from there instead.",
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
    "Something went wrong while opening the old sign-in flow.";

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
            <Link href="/">Back to the app</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
