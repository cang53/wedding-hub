import { redirect } from "next/navigation";

// Root route goes straight to the signed-in dashboard experience.
export default function Index() {
  redirect("/dashboard");
}
