import { Masthead } from "@/components/masthead";
import { TabNav } from "@/components/tab-nav";
import { RoleSelector } from "@/components/role-selector";

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
        <RoleSelector />
      </footer>
    </div>
  );
}
