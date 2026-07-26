import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureClientProfile } from "@/lib/client-data";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");

  // Guarantee a tenant row exists on first login.
  await ensureClientProfile(session.user.id, session.user.name ?? undefined);

  return (
    <div className="flex min-h-screen">
      <AppSidebar variant="client" />
      <main className="flex-1 overflow-x-hidden">
        <div className="container max-w-6xl py-8">{children}</div>
      </main>
    </div>
  );
}
