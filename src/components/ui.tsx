import { initials } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-8 py-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent/15 font-medium text-accent"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name) || "?"}
    </div>
  );
}

export function StrengthDots({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex gap-0.5" title={`Relationship strength ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i <= value ? "bg-accent" : "bg-border"
          }`}
        />
      ))}
    </span>
  );
}

export function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-foreground/5 px-2 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}
