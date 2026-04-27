import { Masthead } from "@/components/masthead";
import { TabNav } from "@/components/tab-nav";
import { signOutAction } from "./actions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[1280px] mx-auto px-12 pt-8 pb-20 max-md:px-4 max-md:pt-5 max-md:pb-15">
      <Masthead />
      <TabNav />

      <div className="min-h-[40vh]">{children}</div>

      <footer className="text-center mt-20 pt-8 border-t border-line font-script text-lg text-ink-soft flex items-center justify-center gap-6">
        <span>~ made for Celal &amp; love, with love ~</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="font-sans text-[11px] uppercase tracking-[0.2em] text-ink-soft/70 hover:text-burgundy transition-colors"
          >
            Sign out
          </button>
        </form>
      </footer>
    </div>
  );
}
