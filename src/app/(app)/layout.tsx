import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/server/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>
  );
}
