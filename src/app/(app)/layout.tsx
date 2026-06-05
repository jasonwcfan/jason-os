import { Sidebar } from "@/components/sidebar";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <RealtimeRefresh />
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
