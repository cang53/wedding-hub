import { redirect } from "next/navigation";

// Phase 1 placeholder. Once the (dashboard) route group is wired in
// the next task, the dashboard at /(dashboard)/page.tsx becomes the real
// root view. For now we redirect to it so the project boots cleanly.
export default function Index() {
  redirect("/dashboard");
}
