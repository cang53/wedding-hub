import { Ornament } from "@/components/ornament";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <header className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.4em] text-burgundy font-medium mb-4">
            Notre Vie à Deux
          </p>
          <h1 className="font-serif text-5xl leading-none text-ink">
            Sign <em>in</em>
          </h1>
          <Ornament />
          <p className="font-script text-lg text-ink-soft mt-2">
            Just for the two of us.
          </p>
        </header>

        <div className="border border-line bg-paper rounded-[4px] p-8 shadow-soft">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft/80">
          Email not on the list? It won&rsquo;t work — this is private.
        </p>
      </div>
    </main>
  );
}
