"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { logout } from "@/app/login/actions";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 py-5">
        <Link href="/" className="font-mono text-lg font-semibold tracking-tight">
          jason<span className="text-accent">.os</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {MODULES.map((m) => {
          const active = pathname.startsWith(m.href);
          const Icon = m.icon;
          const base =
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";

          if (!m.enabled) {
            return (
              <div
                key={m.key}
                title={`${m.description} — coming soon`}
                className={`${base} cursor-default text-muted/50`}
              >
                <Icon size={18} />
                <span>{m.label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted/50">
                  soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={m.key}
              href={m.href}
              className={`${base} ${
                active
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-foreground hover:bg-foreground/5"
              }`}
            >
              <Icon size={18} />
              <span>{m.label}</span>
            </Link>
          );
        })}
      </nav>

      <form action={logout} className="px-3 pb-4">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-foreground/5"
        >
          <LogOut size={18} />
          <span>Lock</span>
        </button>
      </form>
    </aside>
  );
}
