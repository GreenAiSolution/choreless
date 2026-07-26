import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/app");

  return (
    <div className="flex min-h-screen">
      <AppSidebar variant="admin" />
      <main className="flex-1 overflow-x-hidden">
        <div className="container max-w-6xl py-8">{children}</div>
      </main>
    </div>
  );
}
